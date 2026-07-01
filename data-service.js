// Classarium - Firestore Data Service
const DataService = {
    // Generic CRUD operations
    async get(collection, docId) {
        const snap = await db.collection(collection).doc(docId).get();
        return snap.exists ? { id: snap.id, ...snap.data() } : null;
    },

    async getAll(collection, filters = {}) {
        let query = db.collection(collection);
        if (filters.where) {
            filters.where.forEach(([field, op, value]) => {
                query = query.where(field, op, value);
            });
        }
        if (filters.orderBy) {
            query = query.orderBy(filters.orderBy, filters.direction || 'asc');
        }
        if (filters.limit) {
            query = query.limit(filters.limit);
        }
        const snap = await query.get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async getBySchool(collection, schoolId, extraFilters = {}) {
        let query = db.collection(collection).where('schoolId', '==', schoolId);
        if (extraFilters.where) {
            extraFilters.where.forEach(([field, op, value]) => {
                query = query.where(field, op, value);
            });
        }
        if (extraFilters.orderBy) {
            query = query.orderBy(extraFilters.orderBy, extraFilters.direction || 'asc');
        }
        const snap = await query.get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async add(collection, data) {
        data.createdAt = FieldValue.serverTimestamp();
        data.updatedAt = FieldValue.serverTimestamp();
        const ref = await db.collection(collection).add(data);
        return ref.id;
    },

    async update(collection, docId, data) {
        data.updatedAt = FieldValue.serverTimestamp();
        await db.collection(collection).doc(docId).update(data);
    },

    async remove(collection, docId) {
        await db.collection(collection).doc(docId).delete();
    },

    // Real-time listener
    onSnapshot(collection, schoolId, callback, filters = {}) {
        let query = db.collection(collection).where('schoolId', '==', schoolId);
        if (filters.where) {
            filters.where.forEach(([field, op, value]) => {
                query = query.where(field, op, value);
            });
        }
        if (filters.orderBy) {
            query = query.orderBy(filters.orderBy, filters.direction || 'asc');
        }
        return query.onSnapshot(snap => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            callback(data, snap.docChanges());
        });
    },

    // School-specific methods
    async getSchool(schoolId) {
        return this.get('schools', schoolId);
    },

    async getSchoolConfig(schoolId) {
        const doc = await db.collection('schools').doc(schoolId).collection('config').doc('result').get();
        return doc.exists ? doc.data() : null;
    },

    async updateSchoolConfig(schoolId, data) {
        await db.collection('schools').doc(schoolId).collection('config').doc('result').update(data);
    },

    // Student methods
    async getStudents(schoolId, filters = {}) {
        return this.getBySchool('students', schoolId, filters);
    },

    async getStudent(studentId) {
        return this.get('students', studentId);
    },

    async addStudent(data) {
        const schoolId = data.schoolId || App.state.school?.schoolId;
        const count = (await this.getStudents(schoolId)).length;
        const admissionNumber = data.admissionNumber || Utils.generateAdmissionNumber(schoolId, data.classArm, count);

        return this.add('students', {
            ...data,
            schoolId,
            admissionNumber,
            status: 'active',
            totalAttendance: 0,
            presentDays: 0
        });
    },

    // Staff methods
    async getStaff(schoolId) {
        return this.getBySchool('staff', schoolId);
    },

    async addStaff(data) {
        const schoolId = data.schoolId || App.state.school?.schoolId;
        const count = (await this.getStaff(schoolId)).length;
        const staffId = `STF${String(count + 1).padStart(4, '0')}`;

        return this.add('staff', {
            ...data,
            schoolId,
            staffId,
            status: 'active',
            createdAt: FieldValue.serverTimestamp()
        });
    },

    // Attendance methods
    async recordAttendance(data) {
        const { schoolId, date, classArm, records } = data;
        const batch = db.batch();

        records.forEach(rec => {
            const ref = db.collection('attendance').doc();
            batch.set(ref, {
                schoolId,
                studentId: rec.studentId,
                date,
                classArm,
                status: rec.status,
                termId: data.termId || '',
                sessionId: data.sessionId || '',
                recordedBy: data.recordedBy,
                timestamp: FieldValue.serverTimestamp()
            });
        });

        await batch.commit();
    },

    async getAttendance(schoolId, filters = {}) {
        return this.getBySchool('attendance', schoolId, filters);
    },

    // Result methods
    async submitSubjectScore(data) {
        const { schoolId, sessionId, termId, classArm, subjectId, studentId, scores } = data;

        const docId = `${studentId}_${subjectId}_${termId}_${sessionId}`;
        const ref = db.collection('scores').doc(docId);

        const total = (scores.caTest || 0) + (scores.assignment || 0) + (scores.exam || 0);
        const maxTotal = 100;
        const percentage = Utils.percentage(total, maxTotal);
        const gradeInfo = Utils.getGrade(percentage);

        await ref.set({
            schoolId,
            studentId,
            subjectId,
            sessionId,
            termId,
            classArm,
            ...scores,
            total,
            percentage,
            grade: gradeInfo.grade,
            remark: gradeInfo.remark,
            status: 'submitted',
            submittedBy: data.submittedBy,
            submittedAt: FieldValue.serverTimestamp(),
            reviewedBy: null,
            reviewedAt: null,
            approvedBy: null,
            approvedAt: null
        }, { merge: true });

        return docId;
    },

    async getScores(schoolId, sessionId, termId, classArm) {
        const snap = await db.collection('scores')
            .where('schoolId', '==', schoolId)
            .where('sessionId', '==', sessionId)
            .where('termId', '==', termId)
            .where('classArm', '==', classArm)
            .get();

        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    // Chat methods
    async sendMessage(data) {
        return this.add('messages', {
            ...data,
            status: 'sent',
            read: false,
            reactions: [],
            createdAt: FieldValue.serverTimestamp()
        });
    },

    async getConversations(userId) {
        const snap1 = await db.collection('conversations')
            .where('participants', 'array-contains', userId)
            .get();
        return snap1.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async getMessages(conversationId, limit = 50) {
        const snap = await db.collection('conversations')
            .doc(conversationId)
            .collection('messages')
            .orderBy('createdAt', 'desc')
            .limit(limit)
            .get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() })).reverse();
    },

    // Academic structure methods
    async addSession(data) {
        return this.add('sessions', data);
    },
    async addTerm(data) {
        return this.add('terms', data);
    },
    async addDepartment(data) {
        return this.add('departments', data);
    },
    async addClass(data) {
        return this.add('classes', data);
    },
    async addSubject(data) {
        return this.add('subjects', data);
    },

    // Audit logging
    async logAction(schoolId, userId, action, details) {
        await db.collection('auditLogs').add({
            schoolId,
            userId,
            action,
            details,
            timestamp: FieldValue.serverTimestamp()
        });
    },

    // Aggregate queries
    async count(collection, schoolId) {
        // Firestore doesn't support count() in all SDKs, use workaround
        const snap = await db.collection(collection).where('schoolId', '==', schoolId).get();
        return snap.size;
    },

    // Super Admin methods
    async getAllSchools() {
        const snap = await db.collection('schools').orderBy('createdAt', 'desc').get();
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    },

    async getPlatformStats() {
        const schoolsSnap = await db.collection('schools').get();
        const usersSnap = await db.collection('users').get();
        const studentsSnap = await db.collection('students').get();

        return {
            totalSchools: schoolsSnap.size,
            totalUsers: usersSnap.size,
            totalStudents: studentsSnap.size,
            activeSchools: schoolsSnap.docs.filter(d => d.data().status === 'active').length
        };
    }
};

window.DataService = DataService;