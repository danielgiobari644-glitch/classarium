// Classarium - Authentication Service
const AuthService = {
    async registerSchool(data) {
        const { ownerEmail, password, schoolName, ...schoolData } = data;

        // Create auth account
        const cred = await auth.createUserWithEmailAndPassword(ownerEmail, password);
        await cred.user.sendEmailVerification();

        const schoolId = Utils.generateSchoolId(schoolName);

        // Create school document
        const schoolDoc = {
            schoolId,
            name: schoolName,
            ...schoolData,
            status: 'pending_approval',
            plan: 'basic',
            createdAt: FieldValue.serverTimestamp(),
            createdBy: cred.user.uid
        };

        await db.collection('schools').doc(schoolId).set(schoolDoc);

        // Create user profile
        const profileDoc = {
            uid: cred.user.uid,
            email: ownerEmail,
            displayName: data.ownerName,
            role: 'school_admin',
            schoolId: schoolId,
            photoURL: null,
            emailVerified: false,
            createdAt: FieldValue.serverTimestamp(),
            lastLogin: FieldValue.serverTimestamp()
        };

        await db.collection('users').doc(cred.user.uid).set(profileDoc);

        // Create default school config
        await db.collection('schools').doc(schoolId).collection('config').doc('result').set({
            schoolName: schoolName,
            schoolAddress: data.address || '',
            schoolEmail: data.schoolEmail || ownerEmail,
            schoolPhone: data.phone || '',
            schoolMotto: data.schoolMotto || '',
            schoolLogo: null,
            principalSignature: null,
            gradingSystem: [
                { min: 70, max: 100, grade: 'A', remark: 'Excellent' },
                { min: 60, max: 69, grade: 'B', remark: 'Very Good' },
                { min: 50, max: 59, grade: 'C', remark: 'Good' },
                { min: 45, max: 49, grade: 'D', remark: 'Fair' },
                { min: 0, max: 44, grade: 'F', remark: 'Poor' }
            ],
            caWeight: 40,
            examWeight: 60
        });

        // Audit log
        await db.collection('auditLogs').add({
            schoolId,
            userId: cred.user.uid,
            action: 'SCHOOL_REGISTERED',
            details: `School "${schoolName}" registered`,
            timestamp: FieldValue.serverTimestamp()
        });

        return { user: cred.user, schoolId, profileDoc };
    },

    async login(email, password) {
        const cred = await auth.signInWithEmailAndPassword(email, password);
        const profileDoc = await db.collection('users').doc(cred.user.uid).get();
        const profile = profileDoc.exists ? profileDoc.data() : null;

        if (profile) {
            // Update last login
            await db.collection('users').doc(cred.user.uid).update({
                lastLogin: FieldValue.serverTimestamp()
            });

            // Log activity
            await db.collection('auditLogs').add({
                schoolId: profile.schoolId || 'system',
                userId: cred.user.uid,
                action: 'LOGIN',
                details: 'User logged in',
                timestamp: FieldValue.serverTimestamp()
            });
        }

        return { user: cred.user, profile };
    },

    async logout() {
        await auth.signOut();
    },

    async resetPassword(email) {
        await auth.sendPasswordResetEmail(email);
    },

    async getCurrentUser() {
        return new Promise((resolve) => {
            const unsubscribe = auth.onAuthStateChanged(async (user) => {
                unsubscribe();
                if (!user) { resolve(null); return; }
                try {
                    const doc = await db.collection('users').doc(user.uid).get();
                    const profile = doc.exists ? doc.data() : null;
                    resolve({ user, profile });
                } catch (e) {
                    console.error('Error fetching user profile:', e);
                    resolve({ user, profile: null });
                }
            });
        });
    },

    async reloadUser() {
        const user = auth.currentUser;
        if (user) await user.reload();
        return auth.currentUser;
    }
};

window.AuthService = AuthService;