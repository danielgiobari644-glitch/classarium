/**
 * Classarium Communication Module
 * Real-time chat system with direct messages, group chats, and role-based access.
 */
(function () {
  'use strict';

  window.Modules = window.Modules || {};

  var Utils = window.Utils;
  var Toast = window.Toast;
  var DataService = window.DataService;
  var Modal = window.Modal;
  var Router = window.Router;
  var SidebarComponent = window.SidebarComponent;
  var HeaderComponent = window.HeaderComponent;

  /* ------------------------------------------------------------------ */
  /*  State                                                              */
  /* ------------------------------------------------------------------ */

  var _conversations = [];
  var _messages = [];
  var _activeConversation = null;
  var _activeTab = 'direct'; // 'direct' | 'groups'
  var _searchQuery = '';
  var _staff = [];
  var _students = [];
  var _classes = [];
  var _subjects = [];
  var _parentChild = null;
  var _listeners = [];
  var _messagesUnsub = null;
  var _isLoadingMessages = false;
  var _conversationMap = {}; // id -> conversation object

  /* ------------------------------------------------------------------ */
  /*  Helpers                                                            */
  /* ------------------------------------------------------------------ */

  function getProfile() {
    return window.App.state.profile || {};
  }

  function getSchoolId() {
    return getProfile().schoolId || '';
  }

  function getUserId() {
    return getProfile().uid || '';
  }

  function getDisplayName() {
    return getProfile().displayName || 'User';
  }

  function isAdmin() {
    var r = getProfile().role;
    return r === 'school_admin' || r === 'vice_principal';
  }

  function isTeacher() {
    return getProfile().role === 'teacher';
  }

  function isClassManager() {
    return getProfile().role === 'class_manager';
  }

  function isStudent() {
    return getProfile().role === 'student';
  }

  function isParent() {
    return getProfile().role === 'parent';
  }

  function getInitialsBg(name) {
    var colors = ['#4F46E5', '#059669', '#D97706', '#DC2626', '#7C3AED', '#0891B2', '#DB2777', '#65A30D'];
    var idx = 0;
    for (var i = 0; i < (name || '').length; i++) { idx += name.charCodeAt(i); }
    return colors[idx % colors.length];
  }

  function avatarHtml(name, size, online) {
    var initials = Utils.getInitials(name || 'U');
    var s = size || 36;
    var bg = getInitialsBg(name);
    var html = '<div class="avatar" style="width:' + s + 'px;height:' + s + 'px;background:' + bg + ';font-size:' + Math.round(s * 0.38) + 'px">';
    html += initials;
    if (online) {
      html += '<span class="avatar-status online" style="width:' + Math.round(s * 0.28) + 'px;height:' + Math.round(s * 0.28) + 'px;border:2px solid #fff;position:absolute;bottom:0;right:0;border-radius:50%;background:#22C55E"></span>';
    }
    html += '</div>';
    return html;
  }

  function escapeHtml(str) {
    return Utils.escapeHtml(str);
  }

  function formatMessageTime(timestamp) {
    if (!timestamp) return '';
    var d = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    var now = new Date();
    var diffMs = now - d;
    var diffDays = Math.floor(diffMs / 86400000);

    if (diffDays === 0) {
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else if (diffDays < 7) {
      return d.toLocaleDateString('en-US', { weekday: 'short' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function getConversationName(conversation) {
    if (conversation.name) return conversation.name;
    if (!conversation.participantNames) return 'Unknown';
    var uid = getUserId();
    var names = conversation.participantNames || [];
    var other = names.filter(function (n) { return n.uid !== uid; });
    if (other.length === 1) return other[0].displayName || 'Unknown';
    if (other.length > 1) return other.map(function (n) { return n.displayName; }).join(', ');
    return 'Unknown';
  }

  function getConversationAvatar(conversation) {
    if (conversation.type === 'group') {
      return avatarHtml(conversation.name, 40);
    }
    var uid = getUserId();
    var names = conversation.participantNames || [];
    var other = names.find(function (n) { return n.uid !== uid; });
    return avatarHtml(other ? other.displayName : '', 40, other ? other.online : false);
  }

  function getLastMessage(conversation) {
    if (!conversation.lastMessage) return { text: 'No messages yet', time: '' };
    var msg = conversation.lastMessage;
    var text = msg.text || '';
    if (text.length > 40) text = text.substring(0, 40) + '\u2026';
    var sender = '';
    if (msg.senderId !== getUserId()) {
      var names = conversation.participantNames || [];
      var senderObj = names.find(function (n) { return n.uid === msg.senderId; });
      if (senderObj) sender = senderObj.displayName.split(' ')[0] + ': ';
    }
    return { text: sender + text, time: formatMessageTime(msg.createdAt) };
  }

  function getUnreadCount(conversation) {
    if (!conversation.unreadCounts) return 0;
    return conversation.unreadCounts[getUserId()] || 0;
  }

  /* ------------------------------------------------------------------ */
  /*  Data Loading                                                       */
  /* ------------------------------------------------------------------ */

  function loadBaseData() {
    var schoolId = getSchoolId();
    return Promise.all([
      DataService.getBySchool('staff', schoolId),
      DataService.getStudents(schoolId),
      DataService.getBySchool('classes', schoolId, { orderBy: 'name' }),
      DataService.getBySchool('subjects', schoolId, { orderBy: 'name' })
    ]).then(function (results) {
      _staff = results[0] || [];
      _students = results[1] || [];
      _classes = results[2] || [];
      _subjects = results[3] || [];

      // If parent, find child
      if (isParent()) {
        var uid = getUserId();
        _parentChild = _students.find(function (s) {
          return s.parentId === uid || s.guardianId === uid;
        });
      }
    });
  }

  function loadConversations() {
    var uid = getUserId();
    return DataService.getConversations(uid).then(function (convs) {
      _conversations = convs || [];
      _conversationMap = {};
      _conversations.forEach(function (c) { _conversationMap[c.id] = c; });
      return _conversations;
    });
  }

  function loadMessages(conversationId) {
    if (_isLoadingMessages) return Promise.resolve([]);
    _isLoadingMessages = true;

    return DataService.getMessages(conversationId, 80).then(function (msgs) {
      _messages = msgs || [];
      _isLoadingMessages = false;
      return _messages;
    }).catch(function (err) {
      _isLoadingMessages = false;
      console.error('Error loading messages:', err);
      return [];
    });
  }

  function setupMessageListener(conversationId) {
    // Detach previous
    if (_messagesUnsub && typeof _messagesUnsub === 'function') {
      _messagesUnsub();
    }

    try {
      // Use DataService.onSnapshot if available for real-time updates
      var schoolId = getSchoolId();
      var unsub = DataService.onSnapshot(
        'conversations/' + conversationId + '/messages',
        schoolId,
        function (data) {
          // On snapshot we may receive unordered data; sort it
          _messages = data.sort(function (a, b) {
            var tA = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() : (a.createdAt || 0);
            var tB = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() : (b.createdAt || 0);
            return tA - tB;
          });
          renderMessages();
          scrollToBottom();
        },
        { orderBy: 'createdAt' }
      );
      _messagesUnsub = unsub;
    } catch (e) {
      // Fallback: no real-time, just loaded messages
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Conversation Filtering                                             */
  /* ------------------------------------------------------------------ */

  function getFilteredConversations() {
    var list = _conversations;

    // Filter by tab
    if (_activeTab === 'direct') {
      list = list.filter(function (c) { return c.type !== 'group'; });
    } else {
      list = list.filter(function (c) { return c.type === 'group'; });
    }

    // Filter by search
    if (_searchQuery) {
      var q = _searchQuery.toLowerCase();
      list = list.filter(function (c) {
        var name = getConversationName(c).toLowerCase();
        return name.indexOf(q) !== -1;
      });
    }

    // Sort by last message time (most recent first)
    list = list.slice().sort(function (a, b) {
      var tA = a.lastMessage && a.lastMessage.createdAt ? (a.lastMessage.createdAt.toDate ? a.lastMessage.createdAt.toDate().getTime() : new Date(a.lastMessage.createdAt).getTime()) : 0;
      var tB = b.lastMessage && b.lastMessage.createdAt ? (b.lastMessage.createdAt.toDate ? b.lastMessage.createdAt.toDate().getTime() : new Date(b.lastMessage.createdAt).getTime()) : 0;
      return tB - tA;
    });

    return list;
  }

  function ensureGroupConversations() {
    // Auto-create group conversations for classes and subjects if they don't exist
    var uid = getUserId();
    var schoolId = getSchoolId();
    var promises = [];

    if (isStudent()) {
      // Student sees class group and subject groups
      var student = _students.find(function (s) { return s.uid === uid; });
      if (student) {
        var cls = _classes.find(function (c) { return c.id === student.classId; });
        if (cls) {
          var groupId = 'group_class_' + cls.id + '_' + (student.arm || 'default');
          if (!_conversationMap[groupId]) {
            promises.push(createGroupConversation(groupId, cls.name + ' ' + (student.arm || ''), 'class', cls.id, student.arm));
          }
        }
      }
    }

    if (isTeacher()) {
      var teacher = _staff.find(function (s) { return s.uid === uid; });
      if (teacher) {
        // Class groups
        var classIds = teacher.assignedClasses || [];
        classIds.forEach(function (classId) {
          var cls = _classes.find(function (c) { return c.id === classId; });
          if (cls) {
            var arms = cls.arms || ['default'];
            arms.forEach(function (arm) {
              var armName = typeof arm === 'object' ? arm.name : arm;
              var armId = typeof arm === 'object' ? (arm.id || arm.name) : arm;
              var groupId = 'group_class_' + classId + '_' + armId;
              if (!_conversationMap[groupId]) {
                promises.push(createGroupConversation(groupId, cls.name + ' ' + armName + ' Group', 'class', classId, armId));
              }
            });
          }
        });

        // Subject groups
        var subjectIds = teacher.assignedSubjects || [];
        subjectIds.forEach(function (subjectId) {
          var subj = _subjects.find(function (s) { return s.id === subjectId; });
          if (subj) {
            var classIds2 = teacher.assignedClasses || [];
            classIds2.forEach(function (classId) {
              var cls = _classes.find(function (c) { return c.id === classId; });
              if (cls) {
                var arms = cls.arms || ['default'];
                arms.forEach(function (arm) {
                  var armName = typeof arm === 'object' ? arm.name : arm;
                  var armId = typeof arm === 'object' ? (arm.id || arm.name) : arm;
                  var groupId = 'group_subject_' + classId + '_' + armId + '_' + subjectId;
                  if (!_conversationMap[groupId]) {
                    promises.push(createGroupConversation(
                      groupId,
                      cls.name + ' ' + armName + ' ' + subj.name,
                      'subject',
                      classId,
                      armId,
                      subjectId
                    ));
                  }
                });
              }
            });
          }
        });
      }
    }

    return Promise.all(promises);
  }

  function createGroupConversation(id, name, groupType, classId, arm, subjectId) {
    var participants = [getUserId()];
    var participantNames = [{ uid: getUserId(), displayName: getDisplayName(), role: getProfile().role }];

    // Add class manager for this class
    var classManagers = _staff.filter(function (s) { return s.role === 'class_manager'; });
    classManagers.forEach(function (cm) {
      if (participants.indexOf(cm.uid) === -1) {
        participants.push(cm.uid);
        participantNames.push({ uid: cm.uid, displayName: cm.displayName || cm.firstName + ' ' + cm.lastName, role: cm.role });
      }
    });

    // Add admin
    var admins = _staff.filter(function (s) { return s.role === 'school_admin' || s.role === 'vice_principal'; });
    admins.forEach(function (admin) {
      if (participants.indexOf(admin.uid) === -1) {
        participants.push(admin.uid);
        participantNames.push({ uid: admin.uid, displayName: admin.displayName || admin.firstName + ' ' + admin.lastName, role: admin.role });
      }
    });

    // Add students in class
    var studentsInClass = _students.filter(function (st) {
      return st.classId === classId && st.arm === arm && st.status === 'active';
    });
    studentsInClass.forEach(function (st) {
      if (participants.indexOf(st.uid) === -1) {
        participants.push(st.uid);
        participantNames.push({ uid: st.uid, displayName: st.displayName || st.firstName + ' ' + st.lastName, role: 'student' });
      }
    });

    // For subject groups, add the teacher
    if (groupType === 'subject' && subjectId) {
      var teachers = _staff.filter(function (s) {
        return s.assignedSubjects && s.assignedSubjects.indexOf(subjectId) !== -1;
      });
      teachers.forEach(function (t) {
        if (participants.indexOf(t.uid) === -1) {
          participants.push(t.uid);
          participantNames.push({ uid: t.uid, displayName: t.displayName || t.firstName + ' ' + t.lastName, role: t.role });
        }
      });

      // Add parents of students
      studentsInClass.forEach(function (st) {
        if (st.parentId && participants.indexOf(st.parentId) === -1) {
          participants.push(st.parentId);
          participantNames.push({ uid: st.parentId, displayName: 'Parent of ' + (st.displayName || st.firstName), role: 'parent' });
        }
      });
    }

    var data = {
      id: id,
      type: 'group',
      groupType: groupType,
      name: name,
      schoolId: getSchoolId(),
      classId: classId,
      arm: arm,
      subjectId: subjectId || null,
      participants: participants,
      participantNames: participantNames,
      createdBy: getUserId(),
      lastMessage: null,
      unreadCounts: {}
    };

    // Use update with merge to avoid overwriting if exists
    return DataService.update('conversations', id, data).then(function () {
      _conversationMap[id] = data;
      if (_conversations.indexOf(data) === -1) {
        _conversations.push(data);
      }
    }).catch(function (err) {
      // If doc doesn't exist, add it
      return DataService.add('conversations', data).then(function (newId) {
        data.id = newId;
        _conversationMap[newId] = data;
        _conversations.push(data);
      });
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Rendering                                                          */
  /* ------------------------------------------------------------------ */

  function renderChatLayout(container) {
    var html = '<div class="chat-layout">';

    // Sidebar
    html += '<div class="chat-sidebar">';
    html += renderSidebar();
    html += '</div>';

    // Main area
    html += '<div class="chat-main">';
    html += '<div id="chat-main-content"></div>';
    html += '</div>';

    html += '</div>';
    container.innerHTML = html;

    renderMainContent();
  }

  function renderSidebar() {
    var html = '';

    // Header
    html += '<div class="chat-sidebar-header">';
    html += '<h3 style="font-size:16px;font-weight:600;margin:0">Messages</h3>';
    html += '<button class="btn btn-sm btn-primary" id="chat-new-msg-btn">+ New</button>';
    html += '</div>';

    // Tabs
    html += '<div class="chat-tabs">';
    html += '<button class="chat-tab' + (_activeTab === 'direct' ? ' active' : '') + '" data-tab="direct">Direct</button>';
    html += '<button class="chat-tab' + (_activeTab === 'groups' ? ' active' : '') + '" data-tab="groups">Groups</button>';
    html += '</div>';

    // Search
    html += '<div class="chat-search">';
    html += '<input type="text" class="form-input" id="chat-search-input" placeholder="Search conversations\u2026" value="' + escapeHtml(_searchQuery) + '">';
    html += '</div>';

    // Chat list
    html += '<div class="chat-list" id="chat-list">';
    html += renderChatList();
    html += '</div>';

    return html;
  }

  function renderChatList() {
    var convs = getFilteredConversations();

    if (!convs.length) {
      var emptyMsg = _searchQuery ? 'No conversations match your search.' : 'No conversations yet.';
      return '<div style="text-align:center;padding:32px 16px;color:var(--gray-500)">'
        + '<div style="font-size:32px;margin-bottom:8px">\uD83D\uDCAC</div>'
        + '<p style="margin:0;font-size:13px">' + emptyMsg + '</p></div>';
    }

    return convs.map(function (conv) {
      var isActive = _activeConversation && _activeConversation.id === conv.id;
      var name = getConversationName(conv);
      var last = getLastMessage(conv);
      var unread = getUnreadCount(conv);

      return '<div class="chat-item' + (isActive ? ' active' : '') + '" data-conv-id="' + conv.id + '">'
        + getConversationAvatar(conv)
        + '<div class="chat-item-content">'
        + '<div class="chat-item-header">'
        + '<span class="chat-item-name">' + escapeHtml(name) + '</span>'
        + '<span class="chat-item-time">' + last.time + '</span>'
        + '</div>'
        + '<div class="chat-item-preview">' + escapeHtml(last.text) + '</div>'
        + '</div>'
        + (unread ? '<span class="chat-unread-badge">' + unread + '</span>' : '')
        + '</div>';
    }).join('');
  }

  function renderMainContent() {
    var contentEl = document.getElementById('chat-main-content');
    if (!contentEl) return;

    if (!_activeConversation) {
      contentEl.innerHTML = renderEmptyChat();
      return;
    }

    var conv = _activeConversation;
    var name = getConversationName(conv);

    var html = '';

    // Header
    html += '<div class="chat-main-header">';
    html += getConversationAvatar(conv, 36);
    html += '<div class="chat-main-header-info">';
    html += '<h3 style="font-size:15px;font-weight:600;margin:0">' + escapeHtml(name) + '</h3>';
    if (conv.type === 'group') {
      html += '<span style="font-size:12px;color:var(--gray-500)">' + (conv.participants ? conv.participants.length : 0) + ' members</span>';
    } else {
      var uid = getUserId();
      var names = conv.participantNames || [];
      var other = names.find(function (n) { return n.uid !== uid; });
      if (other) {
        html += '<span style="font-size:12px;color:var(--gray-500)">' + Utils.capitalize(other.role || '') + '</span>';
      }
    }
    html += '</div>';
    html += '</div>';

    // Messages
    html += '<div class="chat-messages" id="chat-messages-area">';
    html += renderMessages();
    html += '</div>';

    // Input area
    html += '<div class="chat-input-area">';
    html += '<button class="btn btn-outline btn-icon" id="chat-attach-btn" title="Attach file">\uD83D\uDCE7</button>';
    html += '<input type="text" class="form-input chat-input" id="chat-message-input" placeholder="Type a message\u2026" autocomplete="off">';
    html += '<button class="btn btn-primary" id="chat-send-btn">\u27A4 Send</button>';
    html += '</div>';

    contentEl.innerHTML = html;

    // Scroll to bottom
    scrollToBottom();

    // Focus input
    var input = document.getElementById('chat-message-input');
    if (input) input.focus();
  }

  function renderMessages() {
    if (!_messages.length) {
      return '<div style="text-align:center;padding:48px 16px;color:var(--gray-400)">'
        + '<div style="font-size:40px;margin-bottom:8px">\uD83D\uDCAC</div>'
        + '<p style="margin:0">No messages yet. Say hello!</p></div>';
    }

    var uid = getUserId();
    var html = '';
    var lastDate = '';

    _messages.forEach(function (msg) {
      // Date separator
      var msgDate = '';
      if (msg.createdAt) {
        var d = msg.createdAt.toDate ? msg.createdAt.toDate() : new Date(msg.createdAt);
        msgDate = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      }
      if (msgDate && msgDate !== lastDate) {
        html += '<div class="chat-date-separator"><span>' + msgDate + '</span></div>';
        lastDate = msgDate;
      }

      var isMine = msg.senderId === uid;
      var senderName = '';
      if (!isMine && _activeConversation && _activeConversation.participantNames) {
        var sender = _activeConversation.participantNames.find(function (n) { return n.uid === msg.senderId; });
        if (sender && _activeConversation.type === 'group') {
          senderName = '<div class="chat-message-sender">' + escapeHtml(sender.displayName) + '</div>';
        }
      }

      var timeStr = msg.createdAt ? formatMessageTime(msg.createdAt) : '';
      var readIndicator = isMine && msg.read
        ? '<span class="chat-read-indicator" title="Read">\u2713\u2713</span>'
        : isMine
          ? '<span class="chat-read-indicator" title="Sent">\u2713</span>'
          : '';

      html += '<div class="chat-message' + (isMine ? ' mine' : '') + '">';
      if (!isMine) {
        var senderObj = null;
        if (_activeConversation && _activeConversation.participantNames) {
          senderObj = _activeConversation.participantNames.find(function (n) { return n.uid === msg.senderId; });
        }
        html += avatarHtml(senderObj ? senderObj.displayName : '', 32);
      }
      html += '<div class="chat-message-bubble">';
      html += senderName;
      html += '<div class="chat-message-text">' + escapeHtml(msg.text || '') + '</div>';
      html += '<div class="chat-message-meta">' + timeStr + ' ' + readIndicator + '</div>';
      html += '</div>';
      if (isMine) {
        html += avatarHtml(getDisplayName(), 32);
      }
      html += '</div>';
    });

    return html;
  }

  function renderEmptyChat() {
    return '<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--gray-400)">'
      + '<div style="font-size:64px;margin-bottom:16px">\uD83D\uDCAC</div>'
      + '<h3 style="margin:0 0 8px;color:var(--gray-600)">Classarium Messages</h3>'
      + '<p style="margin:0;font-size:14px;max-width:300px;text-align:center">'
      + 'Select a conversation from the sidebar or start a new one to begin chatting.'
      + '</p></div>';
  }

  function scrollToBottom() {
    var area = document.getElementById('chat-messages-area');
    if (area) {
      area.scrollTop = area.scrollHeight;
    }
  }

  /* ------------------------------------------------------------------ */
  /*  New Conversation Modal                                             */
  /* ------------------------------------------------------------------ */

  function openNewConversationModal() {
    var contacts = getAvailableContacts();

    if (!contacts.length) {
      Toast.warn('No contacts available to message.');
      return;
    }

    var html = '<div style="max-height:400px;overflow-y:auto">';
    html += '<div style="margin-bottom:12px"><input type="text" class="form-input" id="new-conv-search" placeholder="Search contacts\u2026"></div>';
    html += '<div id="new-conv-list">';
    html += contacts.map(function (c) {
      return '<div class="chat-item" data-new-conv-uid="' + c.uid + '" style="cursor:pointer;padding:10px 12px;border-bottom:1px solid var(--gray-100)">'
        + avatarHtml(c.displayName, 36)
        + '<div class="chat-item-content">'
        + '<div class="chat-item-name">' + escapeHtml(c.displayName) + '</div>'
        + '<div style="font-size:12px;color:var(--gray-500)">' + escapeHtml(Utils.capitalize(c.role || '')) + (c.className ? ' \u2022 ' + escapeHtml(c.className) : '') + '</div>'
        + '</div></div>';
    }).join('');
    html += '</div></div>';

    Modal.open({
      title: 'New Message',
      content: html,
      size: 'sm',
      footer: '<button class="btn btn-outline" onclick="window.Modal.close()">Cancel</button>'
    });

    // Search
    setTimeout(function () {
      var searchInput = document.getElementById('new-conv-search');
      if (searchInput) {
        searchInput.addEventListener('input', Utils.debounce(function () {
          var q = this.value.toLowerCase();
          document.querySelectorAll('#new-conv-list .chat-item').forEach(function (item) {
            var name = (item.querySelector('.chat-item-name') || {}).textContent || '';
            item.style.display = name.toLowerCase().indexOf(q) !== -1 ? '' : 'none';
          });
        }, 200));
      }

      // Click contact
      document.querySelectorAll('[data-new-conv-uid]').forEach(function (item) {
        item.addEventListener('click', function () {
          var targetUid = this.getAttribute('data-new-conv-uid');
          Modal.close();
          startConversationWith(targetUid);
        });
      });
    }, 150);
  }

  function getAvailableContacts() {
    var uid = getUserId();
    var contacts = [];

    if (isParent()) {
      // Parent can chat with child's teachers, class manager, and school admin
      if (!_parentChild) return contacts;

      // Child's class manager
      var classManagers = _staff.filter(function (s) {
        return s.role === 'class_manager' && s.classId === _parentChild.classId;
      });
      classManagers.forEach(function (cm) {
        contacts.push({ uid: cm.uid, displayName: cm.displayName || cm.firstName + ' ' + cm.lastName, role: cm.role });
      });

      // Child's teachers
      var teachers = _staff.filter(function (s) { return s.role === 'teacher'; });
      teachers.forEach(function (t) {
        if (t.assignedClasses && t.assignedClasses.indexOf(_parentChild.classId) !== -1) {
          contacts.push({ uid: t.uid, displayName: t.displayName || t.firstName + ' ' + t.lastName, role: t.role });
        }
      });

      // School admin
      var admins = _staff.filter(function (s) { return s.role === 'school_admin' || s.role === 'vice_principal'; });
      admins.forEach(function (a) {
        contacts.push({ uid: a.uid, displayName: a.displayName || a.firstName + ' ' + a.lastName, role: a.role });
      });
    } else if (isTeacher()) {
      // Teachers can chat with students in their classes, class managers, and admin
      var teacher = _staff.find(function (s) { return s.uid === uid; });
      var classIds = teacher ? (teacher.assignedClasses || []) : [];

      // Students
      _students.filter(function (st) {
        return st.status === 'active' && classIds.indexOf(st.classId) !== -1;
      }).forEach(function (st) {
        var cls = _classes.find(function (c) { return c.id === st.classId; });
        contacts.push({
          uid: st.uid,
          displayName: st.displayName || st.firstName + ' ' + st.lastName,
          role: 'student',
          className: cls ? cls.name : ''
        });
      });

      // Parents of students
      _students.filter(function (st) {
        return st.status === 'active' && st.parentId && classIds.indexOf(st.classId) !== -1;
      }).forEach(function (st) {
        var cls = _classes.find(function (c) { return c.id === st.classId; });
        contacts.push({
          uid: st.parentId,
          displayName: 'Parent of ' + (st.displayName || st.firstName),
          role: 'parent',
          className: cls ? cls.name : ''
        });
      });

      // Staff
      _staff.filter(function (s) { return s.uid !== uid; }).forEach(function (s) {
        contacts.push({ uid: s.uid, displayName: s.displayName || s.firstName + ' ' + s.lastName, role: s.role });
      });
    } else if (isAdmin()) {
      // Admin sees all staff and students
      _staff.filter(function (s) { return s.uid !== uid; }).forEach(function (s) {
        contacts.push({ uid: s.uid, displayName: s.displayName || s.firstName + ' ' + s.lastName, role: s.role });
      });
      _students.filter(function (st) { return st.status === 'active'; }).forEach(function (st) {
        var cls = _classes.find(function (c) { return c.id === st.classId; });
        contacts.push({
          uid: st.uid,
          displayName: st.displayName || st.firstName + ' ' + st.lastName,
          role: 'student',
          className: cls ? cls.name : ''
        });
      });
    } else if (isStudent()) {
      // Students can chat with teachers and class manager
      var student = _students.find(function (s) { return s.uid === uid; });
      if (student) {
        // Class manager
        _staff.filter(function (s) { return s.role === 'class_manager' && s.classId === student.classId; }).forEach(function (cm) {
          contacts.push({ uid: cm.uid, displayName: cm.displayName || cm.firstName + ' ' + cm.lastName, role: cm.role });
        });

        // Teachers
        _staff.filter(function (s) {
          return s.role === 'teacher' && s.assignedClasses && s.assignedClasses.indexOf(student.classId) !== -1;
        }).forEach(function (t) {
          contacts.push({ uid: t.uid, displayName: t.displayName || t.firstName + ' ' + t.lastName, role: t.role });
        });

        // Admin
        _staff.filter(function (s) { return s.role === 'school_admin' || s.role === 'vice_principal'; }).forEach(function (a) {
          contacts.push({ uid: a.uid, displayName: a.displayName || a.firstName + ' ' + a.lastName, role: a.role });
        });
      }
    }

    // Deduplicate
    var seen = {};
    return contacts.filter(function (c) {
      if (seen[c.uid] || c.uid === uid) return false;
      seen[c.uid] = true;
      return true;
    });
  }

  function startConversationWith(targetUid) {
    var uid = getUserId();
    // Check if conversation already exists
    var existing = _conversations.find(function (c) {
      return c.type !== 'group' && c.participants && c.participants.indexOf(uid) !== -1 && c.participants.indexOf(targetUid) !== -1;
    });

    if (existing) {
      selectConversation(existing);
      return;
    }

    // Create new conversation
    var targetContact = _staff.find(function (s) { return s.uid === targetUid; })
      || _students.find(function (s) { return s.uid === targetUid; });

    var participantNames = [
      { uid: uid, displayName: getDisplayName(), role: getProfile().role },
      { uid: targetUid, displayName: targetContact ? (targetContact.displayName || targetContact.firstName + ' ' + targetContact.lastName) : 'Unknown', role: targetContact ? targetContact.role : '' }
    ];

    DataService.add('conversations', {
      type: 'direct',
      schoolId: getSchoolId(),
      participants: [uid, targetUid],
      participantNames: participantNames,
      createdBy: uid,
      lastMessage: null,
      unreadCounts: {}
    }).then(function (convId) {
      var newConv = {
        id: convId,
        type: 'direct',
        schoolId: getSchoolId(),
        participants: [uid, targetUid],
        participantNames: participantNames,
        createdBy: uid,
        lastMessage: null,
        unreadCounts: {}
      };
      _conversations.push(newConv);
      _conversationMap[convId] = newConv;
      selectConversation(newConv);
      Toast.success('Conversation started!');
    }).catch(function (err) {
      console.error('Error creating conversation:', err);
      Toast.error('Failed to start conversation.');
    });
  }

  function selectConversation(conv) {
    _activeConversation = conv;

    // Clear unread for this user
    if (conv.unreadCounts && conv.unreadCounts[getUserId()]) {
      delete conv.unreadCounts[getUserId()];
      DataService.update('conversations', conv.id, { unreadCounts: conv.unreadCounts }).catch(function () {});
    }

    // Load messages
    loadMessages(conv.id).then(function () {
      setupMessageListener(conv.id);
      refreshUI();
    });
  }

  /* ------------------------------------------------------------------ */
  /*  Send Message                                                       */
  /* ------------------------------------------------------------------ */

  function sendMessage(text) {
    if (!text || !text.trim()) return;
    if (!_activeConversation) return;

    var uid = getUserId();
    var msgText = text.trim();
    var convId = _activeConversation.id;

    DataService.sendMessage({
      conversationId: convId,
      senderId: uid,
      senderName: getDisplayName(),
      text: msgText,
      schoolId: getSchoolId(),
      participants: _activeConversation.participants || []
    }).then(function (msgId) {
      // Update local messages
      _messages.push({
        id: msgId,
        conversationId: convId,
        senderId: uid,
        senderName: getDisplayName(),
        text: msgText,
        createdAt: new Date(),
        read: false
      });

      // Update conversation's lastMessage and unreadCounts
      var lastMsg = { text: msgText, senderId: uid, createdAt: new Date() };
      _activeConversation.lastMessage = lastMsg;

      // Increment unread for other participants
      var participants = _activeConversation.participants || [];
      var unreadCounts = _activeConversation.unreadCounts || {};
      participants.forEach(function (pid) {
        if (pid !== uid) {
          unreadCounts[pid] = (unreadCounts[pid] || 0) + 1;
        }
      });

      DataService.update('conversations', convId, {
        lastMessage: lastMsg,
        unreadCounts: unreadCounts
      }).catch(function () {});

      renderMessages();
      scrollToBottom();
      updateChatList();
    }).catch(function (err) {
      console.error('Error sending message:', err);
      Toast.error('Failed to send message.');
    });
  }

  /* ------------------------------------------------------------------ */
  /*  UI Refresh                                                         */
  /* ------------------------------------------------------------------ */

  function refreshUI() {
    // Re-render sidebar
    var sidebar = document.querySelector('.chat-sidebar');
    if (sidebar) {
      sidebar.innerHTML = renderSidebar();
      bindSidebarEvents();
    }

    // Re-render main content
    renderMainContent();
    bindMainEvents();
  }

  function updateChatList() {
    var listEl = document.getElementById('chat-list');
    if (listEl) {
      listEl.innerHTML = renderChatList();
      // Re-bind click on chat items
      listEl.querySelectorAll('.chat-item').forEach(function (item) {
        item.addEventListener('click', function () {
          var convId = this.getAttribute('data-conv-id');
          var conv = _conversationMap[convId];
          if (conv) selectConversation(conv);
        });
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Event Binding                                                      */
  /* ------------------------------------------------------------------ */

  function bindEvents(container) {
    bindSidebarEvents();
    bindMainEvents();
  }

  function bindSidebarEvents() {
    // New message button
    var newMsgBtn = document.getElementById('chat-new-msg-btn');
    if (newMsgBtn) {
      newMsgBtn.addEventListener('click', openNewConversationModal);
    }

    // Tabs
    document.querySelectorAll('.chat-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        _activeTab = this.getAttribute('data-tab');
        document.querySelectorAll('.chat-tab').forEach(function (t) { t.classList.remove('active'); });
        this.classList.add('active');
        updateChatList();
      });
    });

    // Search
    var searchInput = document.getElementById('chat-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', Utils.debounce(function () {
        _searchQuery = this.value;
        updateChatList();
      }, 200));
    }

    // Chat items
    var listEl = document.getElementById('chat-list');
    if (listEl) {
      listEl.querySelectorAll('.chat-item').forEach(function (item) {
        item.addEventListener('click', function () {
          var convId = this.getAttribute('data-conv-id');
          var conv = _conversationMap[convId];
          if (conv) {
            selectConversation(conv);
            // Update active state visually
            listEl.querySelectorAll('.chat-item').forEach(function (el) { el.classList.remove('active'); });
            this.classList.add('active');
          }
        });
      });
    }
  }

  function bindMainEvents() {
    // Send button
    var sendBtn = document.getElementById('chat-send-btn');
    if (sendBtn) {
      sendBtn.addEventListener('click', function () {
        var input = document.getElementById('chat-message-input');
        if (input) {
          sendMessage(input.value);
          input.value = '';
          input.focus();
        }
      });
    }

    // Enter key
    var msgInput = document.getElementById('chat-message-input');
    if (msgInput) {
      msgInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage(this.value);
          this.value = '';
        }
      });
    }

    // Attachment button (placeholder)
    var attachBtn = document.getElementById('chat-attach-btn');
    if (attachBtn) {
      attachBtn.addEventListener('click', function () {
        Toast.info('File attachments coming soon!');
      });
    }
  }

  /* ------------------------------------------------------------------ */
  /*  Cleanup                                                            */
  /* ------------------------------------------------------------------ */

  function cleanup() {
    if (_messagesUnsub && typeof _messagesUnsub === 'function') {
      _messagesUnsub();
      _messagesUnsub = null;
    }
    _listeners.forEach(function (unsub) { if (typeof unsub === 'function') unsub(); });
    _listeners = [];
    _conversations = [];
    _messages = [];
    _activeConversation = null;
    _conversationMap = {};
  }

  /* ------------------------------------------------------------------ */
  /*  Public API                                                         */
  /* ------------------------------------------------------------------ */

  var CommunicationModule = {
    render: function () {
      var container = document.getElementById('main-content');
      if (!container) return;

      cleanup();
      container.innerHTML = '<div style="text-align:center;padding:60px"><div class="spinner" style="width:36px;height:36px;border:3px solid var(--gray-200);border-top-color:var(--primary);border-radius:50%;animation:spin .8s linear infinite;margin:0 auto"></div><p style="margin-top:12px;color:var(--gray-500)">Loading messages\u2026</p></div>';

      Promise.all([
        loadBaseData(),
        loadConversations()
      ]).then(function () {
        // Ensure group conversations exist
        return ensureGroupConversations();
      }).then(function () {
        // Re-render chat list after groups ensured
        renderChatLayout(container);
        bindEvents(container);
      }).catch(function (err) {
        console.error('Error loading communication module:', err);
        container.innerHTML = '<div style="text-align:center;padding:60px;color:var(--gray-500)">'
          + '<div style="font-size:48px;margin-bottom:12px">\u26A0</div>'
          + '<h3>Could not load messages</h3>'
          + '<p>Please refresh the page and try again.</p></div>';
        Toast.error('Failed to load messages.');
      });
    },

    destroy: function () {
      cleanup();
    }
  };

  window.Modules.communication = CommunicationModule;
})();