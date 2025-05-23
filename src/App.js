import React, { useState, useEffect } from 'react';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  updateDoc, 
  getDoc, 
  query, 
  where, 
  setDoc, 
  onSnapshot, 
  runTransaction, 
  arrayUnion,
  writeBatch
} from 'firebase/firestore';
import './App.css';
import AttendanceCalendar from './components/AttendanceCalendar';
import Profile from './components/Profile';
import HomePage from './components/HomePage';
import { Routes, Route, useNavigate } from 'react-router-dom';
import ExamsList from './components/exams/ExamsList';
import ExamResults from './exams/ExamResults';
import TakeExam from './exams/TakeExam';
import CreateExam from './exams/CreateExam';

const firebaseConfig = {
  apiKey: "AIzaSyDoLr3Dnb5YbCnUtTexaz84YOH5h8Ukfoc",
  authDomain: "frist-b073a.firebaseapp.com",
  projectId: "frist-b073a",
  storageBucket: "frist-b073a.appspot.com",
  messagingSenderId: "580630150830",
  appId: "1:580630150830:web:815ba6942a64909329b73f",
  measurementId: "G-GH3D6EMB6L"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const examService = {
  getExamsForGroup: async (groupId) => {
    try {
      const q = query(collection(db, "exams"), where("groupId", "==", groupId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Error fetching exams:", error);
      return [];
    }
  },

  listenForExams: (groupId, callback) => {
    const q = query(collection(db, "exams"), where("groupId", "==", groupId));
    return onSnapshot(q, (querySnapshot) => {
      const exams = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      callback(exams);
    });
  },

  createExam: async (examData) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("يجب تسجيل الدخول أولاً");
      
      const examWithCreator = {
        ...examData,
        creatorId: user.uid,
        createdAt: new Date(),
        status: 'draft'
      };
      
      const docRef = await addDoc(collection(db, "exams"), examWithCreator);
      return docRef.id;
    } catch (error) {
      console.error("Error creating exam:", error);
      throw error;
    }
  },

  updateExam: async (examId, updates) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("يجب تسجيل الدخول أولاً");
      
      const examRef = doc(db, "exams", examId);
      const examSnap = await getDoc(examRef);
      
      if (!examSnap.exists()) {
        throw new Error("الامتحان غير موجود");
      }
      
      if (examSnap.data().creatorId !== user.uid) {
        throw new Error("ليس لديك صلاحية تعديل هذا الامتحان");
      }
      
      await updateDoc(examRef, updates);
    } catch (error) {
      console.error("Error updating exam:", error);
      throw error;
    }
  },

  deleteExam: async (examId) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("يجب تسجيل الدخول أولاً");
      
      const examRef = doc(db, "exams", examId);
      const examSnap = await getDoc(examRef);
      
      if (!examSnap.exists()) {
        throw new Error("الامتحان غير موجود");
      }
      
      if (examSnap.data().creatorId !== user.uid) {
        throw new Error("ليس لديك صلاحية حذف هذا الامتحان");
      }
      
      const batch = writeBatch(db);
      
      // حذف النتائج المرتبطة بالامتحان
      const resultsQuery = query(
        collection(db, "examResults"), 
        where("examId", "==", examId)
      );
      const resultsSnapshot = await getDocs(resultsQuery);
      
      resultsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      batch.delete(examRef);
      await batch.commit();
    } catch (error) {
      console.error("Error deleting exam:", error);
      throw error;
    }
  },

  getExamResults: async (examId) => {
    try {
      const q = query(collection(db, "examResults"), where("examId", "==", examId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      console.error("Error fetching exam results:", error);
      return [];
    }
  },

  submitExamResults: async (results) => {
    try {
      const user = auth.currentUser;
      if (!user) throw new Error("يجب تسجيل الدخول أولاً");
      
      const resultData = {
        ...results,
        userId: user.uid,
        studentName: user.displayName || `User_${user.uid.slice(0, 5)}`,
        submittedAt: new Date()
      };
      
      const docRef = await addDoc(collection(db, "examResults"), resultData);
      return docRef.id;
    } catch (error) {
      console.error("Error submitting exam results:", error);
      throw error;
    }
  }
};

const userService = {
  createOrUpdateUser: async (user, additionalData = {}) => {
    try {
      await setDoc(doc(db, "users", user.uid), {
        displayName: user.displayName || '',
        photoURL: user.photoURL || '',
        email: user.email || '',
        lastLogin: new Date(),
        ...additionalData
      }, { merge: true });
      return true;
    } catch (error) {
      console.error("Error in createOrUpdateUser:", error);
      return false;
    }
  },

  getUserData: async (userId) => {
    try {
      const docRef = doc(db, "users", userId);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() : null;
    } catch (error) {
      console.error("Error in getUserData:", error);
      return null;
    }
  },

  updateProfile: async (userId, profileData) => {
    try {
      await updateDoc(doc(db, "users", userId), profileData);
      return true;
    } catch (error) {
      console.error("Error in updateProfile:", error);
      return false;
    }
  }
};

function Timer({ user, onBack, groupId }) {
  const [isRunning, setIsRunning] = useState(false);
  const [time, setTime] = useState(0);
  const [points, setPoints] = useState(0);
  const [lastUpdateTime, setLastUpdateTime] = useState(0);
  const [members, setMembers] = useState([]);
  const [showMembers, setShowMembers] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [bannedMembers, setBannedMembers] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [darkMode, setDarkMode] = useState(false);
  const [language, setLanguage] = useState('ar');
  const [notification, setNotification] = useState(null);
  const [studySessions, setStudySessions] = useState([]);
  const [activeTab, setActiveTab] = useState('timer');
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [activeEffects, setActiveEffects] = useState([]);
  const [hoveredItem, setHoveredItem] = useState(null);
  const [hoveredAvatar, setHoveredAvatar] = useState(null);
  const [exams, setExams] = useState([]);
  const [selectedExam, setSelectedExam] = useState(null);
  const [activeExamTab, setActiveExamTab] = useState('list');
  const [examLoading, setExamLoading] = useState(false);

  useEffect(() => {
    if (groupId) {
      const unsubscribe = examService.listenForExams(groupId, (examsData) => {
        setExams(examsData);
      });
      return () => unsubscribe();
    }
  }, [groupId]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('ServiceWorker registration successful');
        })
        .catch(err => {
          console.log('ServiceWorker registration failed: ', err);
        });
    }
  }, []);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'SyncManager' in window) {
      navigator.serviceWorker.ready.then(registration => {
        registration.sync.register('sync-timer');
      });
    }
  }, []);

  const calculateLevel = (points) => {
    const base = 100;
    const growthFactor = 1.15;
    
    let level = 1;
    let requiredPoints = base;
    let totalPointsNeeded = base;
    
    while (points >= totalPointsNeeded) {
      level++;
      requiredPoints = Math.floor(requiredPoints * growthFactor);
      totalPointsNeeded += requiredPoints;
    }
    
    const pointsForCurrentLevel = points - (totalPointsNeeded - requiredPoints);
    
    return {
      currentLevel: level,
      nextLevelPoints: requiredPoints,
      progress: (pointsForCurrentLevel / requiredPoints) * 100,
      pointsToNextLevel: requiredPoints - pointsForCurrentLevel
    };
  };

  const { currentLevel, progress, pointsToNextLevel } = calculateLevel(points);

  const getBadge = (level) => {
    const badges = {
      1: { name: "البذرة", icon: "🌱", color: "var(--secondary-color)", bgColor: "rgba(16, 185, 129, 0.1)" },
      5: { name: "المتدرب", icon: "📖", color: "var(--primary-color)", bgColor: "rgba(79, 70, 229, 0.1)" },
      10: { name: "المجتهد", icon: "🎓", color: "var(--warning-color)", bgColor: "rgba(245, 158, 11, 0.1)" },
      20: { name: "الخبير", icon: "🔍", color: "var(--accent-color)", bgColor: "rgba(239, 68, 68, 0.1)" },
      30: { name: "العبقري", icon: "🧠", color: "var(--primary-dark)", bgColor: "rgba(67, 56, 202, 0.1)" },
      50: { name: "الأسطورة", icon: "🏆", color: "var(--warning-dark)", bgColor: "rgba(217, 119, 6, 0.1)" },
      100: { name: "رائد المعرفة", icon: "🚀", color: "var(--secondary-dark)", bgColor: "rgba(5, 150, 105, 0.1)" }
    };
    
    const eligibleLevels = Object.keys(badges)
      .map(Number)
      .filter(lvl => level >= lvl)
      .sort((a, b) => b - a);
    
    return badges[eligibleLevels[0]] || badges[1];
  };

  const currentBadge = getBadge(currentLevel);

  const shopItems = [
    { 
      id: "boost", 
      name: "دفعة النجاح", 
      description: "يحقق ضعف النقاط لمدة 30 دقيقة",
      price: 400, 
      icon: "⚡", 
      effect: "double_points", 
      color: "var(--warning-color)",
      bgColor: "rgba(245, 158, 11, 0.1)",
      hoverEffect: "glow"
    },
    { 
      id: "focus", 
      name: "معزز التركيز", 
      description: "يزيد سرعة تحصيل النقاط بنسبة 50% لمدة ساعة",
      price: 300, 
      icon: "🧠", 
      effect: "speed_boost", 
      color: "var(--primary-color)",
      bgColor: "rgba(79, 70, 229, 0.1)",
      hoverEffect: "pulse"
    },
    { 
      id: "crown", 
      name: "التاج الذهبي", 
      description: "يظهر تاج ذهبي بجانب اسمك في لوحة المتصدرين",
      price: 600, 
      icon: "👑", 
      effect: "golden_crown", 
      color: "var(--warning-dark)",
      bgColor: "rgba(217, 119, 6, 0.1)",
      hoverEffect: "float"
    },
    { 
      id: "shield", 
      name: "حافظة النقاط", 
      description: "يحمي نقاطك من الخسارة لمدة 24 ساعة",
      price: 350, 
      icon: "🛡️", 
      effect: "points_shield", 
      color: "var(--secondary-color)",
      bgColor: "rgba(16, 185, 129, 0.1)",
      hoverEffect: "shake"
    }
  ];

  const purchaseItem = async (item) => {
    if (points >= item.price) {
      try {
        await runTransaction(db, async (transaction) => {
          const userDoc = await transaction.get(doc(db, "users", user.uid));
          transaction.update(doc(db, "users", user.uid), {
            points: userDoc.data().points - item.price,
            inventory: arrayUnion(item.id)
          });
        });
        
        setPoints(prev => prev - item.price);
        setInventory(prev => [...prev, item.id]);
        applyItemEffect(item);
        showNotification(`🎉 تم شراء ${item.name}!`);
      } catch (error) {
        console.error("Error purchasing item:", error);
        showNotification("⚠️ حدث خطأ أثناء الشراء");
      }
    } else {
      showNotification("❌ نقاطك غير كافية!");
    }
  };

  const applyItemEffect = (item) => {
    const effectMap = {
      'double_points': 30 * 60 * 1000,
      'speed_boost': 60 * 60 * 1000,
      'golden_crown': 24 * 60 * 60 * 1000,
      'points_shield': 24 * 60 * 60 * 1000
    };
    
    if (effectMap[item.effect]) {
      setActiveEffects(prev => [
        ...prev,
        {
          type: item.effect,
          expires: Date.now() + effectMap[item.effect],
          itemId: item.id
        }
      ]);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveEffects(prev => 
        prev.filter(effect => effect.expires > Date.now())
      );
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    document.documentElement.setAttribute('data-theme', newMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', JSON.stringify(newMode));
    showNotification(newMode ? '🌙 تم تفعيل الوضع المظلم' : '☀️ تم تفعيل الوضع الفاتح');
  };

  const changeLanguage = (lang) => {
    setLanguage(lang);
    localStorage.setItem('language', lang);
    showNotification(lang === 'ar' ? '🇸🇦 تم تغيير اللغة إلى العربية' : '🇬🇧 Language changed to English');
  };

  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const addStudySession = (duration, pointsEarned) => {
    const newSession = {
      date: new Date(),
      duration,
      pointsEarned
    };
    setStudySessions(prev => [newSession, ...prev].slice(0, 10));
  };

  const updatePoints = async (newPoints) => {
    try {
      const groupDoc = await getDoc(doc(db, "studyGroups", groupId));
      if (groupDoc.exists() && !groupDoc.data().bannedMembers?.includes(user.uid)) {
        await updateDoc(doc(db, "studyGroups", groupId), {
          [`userPoints.${user.uid}`]: newPoints
        });
      }
    } catch (error) {
      console.error("Error updating points:", error);
    }
  };

  const fetchGroupData = async () => {
    try {
      setLoadingMembers(true);
      const groupDoc = await getDoc(doc(db, "studyGroups", groupId));
      if (groupDoc.exists()) {
        const groupData = groupDoc.data();
        setIsCreator(groupData.creator === user.uid);
        setBannedMembers(groupData.bannedMembers || []);
        
        const userPoints = groupData.userPoints?.[user.uid] || 0;
        setPoints(userPoints);
        
        if (groupData.members) {
          const membersPromises = groupData.members.map(async (uid) => {
            const userDoc = await getDoc(doc(db, "users", uid));
            if (userDoc.exists()) {
              return {
                uid,
                name: userDoc.data().displayName,
                photoURL: userDoc.data().photoURL,
                points: groupData.userPoints?.[uid] || 0
              };
            }
            return null;
          });
          
          const membersList = (await Promise.all(membersPromises)).filter(Boolean);
          membersList.sort((a, b) => b.points - a.points);
          setMembers(membersList);
        }
      }
    } catch (error) {
      console.error("Error fetching group data:", error);
    } finally {
      setLoadingMembers(false);
    }
  };
  
  useEffect(() => {
    fetchGroupData();
    
    const unsubscribe = onSnapshot(doc(db, "studyGroups", groupId), fetchGroupData);
    return () => unsubscribe();
  }, [groupId, user.uid]);

  useEffect(() => {
    let interval;
    if (isRunning) {
      interval = setInterval(() => {
        setTime(prev => {
          const newTime = prev + 1;
          if (newTime % 30 === 0) {
            const pointsEarned = activeEffects.some(e => e.type === 'double_points') ? 2 : 1;
            setPoints(prevPoints => prevPoints + pointsEarned);
            addStudySession(newTime, pointsEarned);
          }
          return newTime;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, activeEffects]);

  useEffect(() => {
    if (isRunning && time > 0 && time % 30 === 0 && time !== lastUpdateTime) {
      const newPoints = points + (activeEffects.some(e => e.type === 'double_points') ? 2 : 1);
      setPoints(newPoints);
      updatePoints(newPoints);
      setLastUpdateTime(time);
      
      const newLevelData = calculateLevel(newPoints);
      if (newLevelData.currentLevel > currentLevel) {
        showNotification(`🎉 تقدمت للمستوى ${newLevelData.currentLevel}!`);
      }
    }
  }, [time, isRunning]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchGroupData();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    const savedMode = JSON.parse(localStorage.getItem('darkMode'));
    if (savedMode !== null) {
      setDarkMode(savedMode);
      document.documentElement.setAttribute('data-theme', savedMode ? 'dark' : 'light');
    }

    const savedLang = localStorage.getItem('language') || 'ar';
    setLanguage(savedLang);
  }, []);

  const removeMember = async (memberId) => {
    if (window.confirm(`هل أنت متأكد من حذف هذا العضو من المجموعة؟`)) {
      try {
        await runTransaction(db, async (transaction) => {
          const groupDoc = await transaction.get(doc(db, "studyGroups", groupId));
          if (!groupDoc.exists()) throw new Error("المجموعة غير موجودة");
          
          const groupData = groupDoc.data();
          const updatedMembers = groupData.members.filter(m => m !== memberId);
          const updatedUserPoints = {...groupData.userPoints};
          delete updatedUserPoints[memberId];
          
          transaction.update(doc(db, "studyGroups", groupId), {
            members: updatedMembers,
            userPoints: updatedUserPoints
          });
        });
        showNotification("✅ تم حذف العضو بنجاح");
      } catch (error) {
        console.error("Error removing member:", error);
        showNotification("❌ حدث خطأ أثناء حذف العضو");
      }
    }
  };

  const toggleBanMember = async (memberId) => {
    if (window.confirm(`هل أنت متأكد من ${bannedMembers.includes(memberId) ? 'إلغاء حظر' : 'حظر'} هذا العضو؟`)) {
      try {
        await runTransaction(db, async (transaction) => {
          const groupDoc = await transaction.get(doc(db, "studyGroups", groupId));
          if (!groupDoc.exists()) throw new Error("المجموعة غير موجودة");
          
          const groupData = groupDoc.data();
          const currentBanned = groupData.bannedMembers || [];
          const isBanned = currentBanned.includes(memberId);
          
          const updatedBanned = isBanned 
            ? currentBanned.filter(id => id !== memberId)
            : [...currentBanned, memberId];
          
          const updates = {
            bannedMembers: updatedBanned,
            banHistory: arrayUnion({
              memberId: memberId,
              bannedBy: user.uid,
              timestamp: new Date(),
              action: isBanned ? "unban" : "ban"
            })
          };
          
          if (!isBanned) {
            updates[`userPoints.${memberId}`] = 0;
          }
          
          transaction.update(doc(db, "studyGroups", groupId), updates);
        });
        
        showNotification(`✅ تم ${bannedMembers.includes(memberId) ? 'إلغاء حظر' : 'حظر'} العضو بنجاح`);
      } catch (error) {
        console.error("Error updating banned members:", error);
        showNotification("❌ حدث خطأ أثناء تحديث قائمة الحظر");
      }
    }
  };

  const resetTimer = () => {
    setIsRunning(false);
    setTime(0);
    showNotification("⏱ تم إعادة ضبط المؤقت");
  };

  const toggleMembersSidebar = () => {
    setShowMembers(prev => !prev);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      const randomOnline = members
        .filter(() => Math.random() > 0.7)
        .map(member => member.uid);
      setOnlineUsers(randomOnline);
    }, 10000);

    return () => clearInterval(interval);
  }, [members]);


  const handleActivateExam = async (exam) => {
    setExamLoading(true);
    try {
      await examService.updateExam(exam.id, { 
        status: 'active',
        activatedAt: new Date()
      });
      showNotification('تم تفعيل الامتحان بنجاح');
    } catch (error) {
      console.error('Error activating exam:', error);
      showNotification(`حدث خطأ أثناء تفعيل الامتحان: ${error.message}`);
    } finally {
      setExamLoading(false);
    }
  };

  const handleDeleteExam = async (exam) => {
    if (window.confirm(`هل أنت متأكد من حذف الامتحان "${exam.title}"؟`)) {
      setExamLoading(true);
      try {
        await examService.deleteExam(exam.id);
        showNotification('تم حذف الامتحان بنجاح');
      } catch (error) {
        console.error('Error deleting exam:', error);
        showNotification(`حدث خطأ أثناء حذف الامتحان: ${error.message}`);
      } finally {
        setExamLoading(false);
      }
    }
  };

  const handleExamSubmitted = async (examId, answers) => {
    setExamLoading(true);
    try {
      const examDoc = await getDoc(doc(db, "exams", examId));
      if (!examDoc.exists() || examDoc.data().status !== 'active') {
        throw new Error("الامتحان غير متاح حالياً");
      }

      const score = calculateScore(answers);
      await examService.submitExamResults({
        examId,
        questions: selectedExam.questions,
        answers,
        score,
        totalQuestions: selectedExam.questions.length,
        correctAnswers: selectedExam.questions.filter((q, i) => q.correctAnswer === answers[i]).length
      });
      showNotification(`تم تسليم الامتحان بنجاح! نتيجتك: ${score} نقطة`);
      setActiveExamTab('list');
    } catch (error) {
      console.error('Error submitting exam:', error);
      showNotification(`حدث خطأ أثناء تسليم الامتحان: ${error.message}`);
    } finally {
      setExamLoading(false);
    }
  };


  const calculateScore = (answers) => {
    if (!selectedExam) return 0;
    let score = 0;
    selectedExam.questions.forEach((q, index) => {
      if (answers[index] === q.correctAnswer) {
        score += q.points || 1;
      }
    });
    return score;
  };

  return (
    <div className="app-container">
      <div className="top-tabs">
        <button 
          className="menu-toggle" 
          onClick={() => setSideMenuOpen(!sideMenuOpen)}
          aria-label="قائمة"
        >
          ☰
        </button>
        
        <div className="main-tabs">
          <button 
            className={`tab-button ${activeTab === 'timer' ? 'active' : ''}`}
            onClick={() => setActiveTab('timer')}
          >
            <span className="tab-icon">⏱️</span>
            <span className="tab-label">المؤقت</span>
          </button>
          
          {isCreator && (
            <button 
              className={`tab-button ${activeTab === 'attendance' ? 'active' : ''}`}
              onClick={() => setActiveTab('attendance')}
            >
              <span className="tab-icon">📅</span>
              <span className="tab-label">جدول الحضور</span>
            </button>
          )}
          
          <button 
            className={`tab-button ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <span className="tab-icon">👤</span>
            <span className="tab-label">الملف الشخصي</span>
          </button>
          
          <button 
            className={`tab-button ${activeTab === 'shop' ? 'active' : ''}`}
            onClick={() => setActiveTab('shop')}
          >
            <span className="tab-icon">🛒</span>
            <span className="tab-label">المتجر</span>
          </button>

          <button 
            className={`tab-button ${activeTab === 'exams' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('exams');
              setActiveExamTab('list');
            }}
          >
            <span className="tab-icon">📝</span>
            <span className="tab-label">الاختبارات</span>
          </button>
        </div>
      </div>

      <div className={`side-menu ${sideMenuOpen ? 'open' : ''}`}>
        <button 
          className="close-menu" 
          onClick={() => setSideMenuOpen(false)}
          aria-label="إغلاق القائمة"
        >
          ✕
        </button>
        
        <div className="menu-section">
          <h3>مجموعاتك</h3>
          <button 
            onClick={onBack} 
            className="back-button"
          >
            ← العودة للمجموعات
          </button>
        </div>
        
        <div className="menu-section">
          <h3>إنجازاتك</h3>
          <div 
            className="badge-display" 
            style={{ 
              backgroundColor: currentBadge.bgColor,
              borderLeft: `4px solid ${currentBadge.color}`
            }}
          >
            <span 
              className="badge-icon"
              style={{ color: currentBadge.color }}
            >
              {currentBadge.icon}
            </span>
            <div className="badge-info">
              <span className="badge-name" style={{ color: currentBadge.color }}>
                {currentBadge.name}
              </span>
              <span className="badge-level" style={{ color: currentBadge.color }}>
                المستوى {currentLevel}
              </span>
            </div>
          </div>
        </div>
        
        <div className="menu-section">
          <h3>الإعدادات</h3>
          <div className="settings-option">
            <span>الوضع المظلم:</span>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={darkMode} 
                onChange={toggleDarkMode}
              />
              <span className="slider round"></span>
            </label>
          </div>
          
          <div className="settings-option">
            <span>اللغة:</span>
            <div className="language-buttons">
              <button 
                className={`language-button ${language === 'ar' ? 'active' : ''}`}
                onClick={() => changeLanguage('ar')}
              >
                العربية
              </button>
              <button 
                className={`language-button ${language === 'en' ? 'active' : ''}`}
                onClick={() => changeLanguage('en')}
              >
                English
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="main-content">
        {activeTab === 'timer' && (
          <div className="timer-container">
            <div className="time-display">
              <h2>وقت المذاكرة</h2>
              <div className="time">{formatTime(time)}</div>
            </div>
            
            <div className="stats-display">
              <div className="stat-box">
                <span className="stat-label">النقاط</span>
                <span className="stat-value">{points}</span>
              </div>
              
              <div className="stat-box">
                <span className="stat-label">المستوى</span>
                <span className="stat-value">{currentLevel}</span>
              </div>
            </div>
            
            <div className="progress-container">
              <div className="progress-label">
                <span>التقدم للمستوى {currentLevel + 1}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="progress-text">
                {pointsToNextLevel} نقطة متبقية للوصول للمستوى التالي
              </div>
            </div>
            
            <div className="timer-controls">
              <button 
                onClick={() => setIsRunning(!isRunning)}
                className={`control-button ${isRunning ? 'pause-button' : 'start-button'}`}
                disabled={bannedMembers.includes(user.uid)}
              >
                {isRunning ? ' إيقاف' : ' بدء'}
              </button>
              
              <button 
                onClick={resetTimer}
                className="control-button reset-button"
              >
                 إعادة تعيين
              </button>
              
              <button
                onClick={toggleMembersSidebar}
                className="control-button members-button"
              >
                {showMembers ? ' إخفاء الأعضاء' : ' عرض الأعضاء'}
              </button>
            </div>

            {activeEffects.length > 0 && (
              <div className="active-effects">
                <h3>التأثيرات النشطة</h3>
                <div className="effects-list">
                  {activeEffects.map((effect, index) => {
                    const item = shopItems.find(i => i.id === effect.itemId);
                    if (!item) return null;
                    
                    return (
                      <div key={index} className="active-effect">
                        <span className="effect-icon" style={{ color: item.color }}>
                          {item.icon}
                        </span>
                        <span className="effect-name">{item.name}</span>
                        <span className="effect-time">
                          {Math.ceil((effect.expires - Date.now()) / (60 * 1000))} دقائق متبقية
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'profile' && (
          <div className="profile-container">
            <div className="profile-header">
              <img 
                src={user.photoURL} 
                alt="صورة الملف الشخصي" 
                className="profile-avatar"
              />
              <h2>{user.displayName}</h2>
              <p className="user-level">المستوى {currentLevel}</p>
            </div>
            
            <div className="profile-stats">
              <div className="stat-row">
                <span className="stat-label">إجمالي النقاط:</span>
                <span className="stat-value">{points}</span>
              </div>
              
              <div className="stat-row">
                <span className="stat-label">إجمالي وقت الدراسة:</span>
                <span className="stat-value">{Math.floor(time / 3600)} ساعة</span>
              </div>
              
              <div className="stat-row">
                <span className="stat-label">النقاط للوصول للمستوى التالي:</span>
                <span className="stat-value">{pointsToNextLevel}</span>
              </div>
            </div>
            
            {studySessions.length > 0 && (
              <div className="sessions-history">
                <h3>آخر جلسات الدراسة</h3>
                <div className="sessions-list">
                  {studySessions.map((session, index) => (
                    <div key={index} className="session-item">
                      <span className="session-date">
                        {new Date(session.date).toLocaleDateString()}
                      </span>
                      <span className="session-duration">
                        {formatTime(session.duration)}
                      </span>
                      <span className="session-points">
                        +{session.pointsEarned} نقطة
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'shop' && (
          <div className="shop-container">
            <h2>متجر النقاط</h2>
            <div className="balance-display">
              <span>رصيدك الحالي:</span>
              <span className="points-balance">{points} نقطة</span>
            </div>
            <div className="shop-items">
              {shopItems.map(item => (
                <div 
                  key={item.id} 
                  className={`shop-item ${hoveredItem === item.id ? 'hovered' : ''} ${hoveredItem === item.id ? item.hoverEffect : ''}`}
                  style={{ 
                    borderColor: item.color,
                    backgroundColor: item.bgColor,
                  }}
                  onMouseEnter={() => setHoveredItem(item.id)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <div 
                    className="item-icon" 
                    style={{ color: item.color }}
                  >
                    {item.icon}
                  </div>
                  <h3>{item.name}</h3>
                  <p className="item-description">{item.description}</p>
                  <p className="item-price" style={{ color: item.color }}>
                    {item.price} نقطة
                  </p>
                  <button 
                    onClick={() => purchaseItem(item)}
                    disabled={points < item.price}
                    className={points < item.price ? 'disabled' : ''}
                    style={{ backgroundColor: item.color }}
                  >
                    {points < item.price ? 'نقاط غير كافية' : 'شراء'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {activeTab === 'attendance' && isCreator && (
          <AttendanceCalendar 
            groupId={groupId} 
            userId={user.uid} 
            isCreator={isCreator} 
          />
        )}

        {activeTab === 'exams' && (
          <div className="exams-container">
            {examLoading && (
              <div className="loading-overlay">
                <div className="spinner"></div>
                <p>جاري التحميل...</p>
              </div>
            )}
            
            {activeExamTab === 'list' && (
              <ExamsList 
                exams={exams} 
                isCreator={isCreator}
                currentUserId={user?.uid}
                onActivateExam={handleActivateExam}
                onDeleteExam={handleDeleteExam}
                onStartCreate={() => setActiveExamTab('create')}
                onViewResults={(exam) => {
                  setSelectedExam(exam);
                  setActiveExamTab('results');
                }}
                onTakeExam={(exam) => {
                  setSelectedExam(exam);
                  setActiveExamTab('take');
                }}
              />
            )}
            
            {activeExamTab === 'create' && (
              <CreateExam 
                groupId={groupId} 
                userId={user.uid} 
                onExamCreated={() => {
                  setActiveExamTab('list');
                  showNotification('تم إنشاء الامتحان بنجاح');
                }}
                onCancel={() => setActiveExamTab('list')}
              />
            )}
            
            {activeExamTab === 'results' && selectedExam && (
              <ExamResults 
                examId={selectedExam.id} 
                onBack={() => setActiveExamTab('list')}
              />
            )}
            
            {activeExamTab === 'take' && selectedExam && (
              <TakeExam 
                exam={selectedExam} 
                userId={user.uid} 
                onComplete={handleExamSubmitted}
                onBack={() => setActiveExamTab('list')}
              />
            )}
          </div>
        )}
      </div>

      <div className={`members-sidebar ${showMembers ? 'show' : ''}`}>
        <div className="sidebar-header">
          <h3>ترتيب المجموعة</h3>
          <button 
            className="close-sidebar" 
            onClick={toggleMembersSidebar}
          >
            ✕
          </button>
        </div>
        
        {loadingMembers ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>جاري تحميل الأعضاء...</p>
          </div>
        ) : (
          <>
            <div className="leaderboard">
              {members
                .filter(member => !bannedMembers.includes(member.uid))
                .map((member, index) => (
                  <div 
                    key={member.uid} 
                    className={`member-item ${member.uid === user.uid ? 'current-user' : ''}`}
                    onMouseEnter={() => setHoveredAvatar(member.uid)}
                    onMouseLeave={() => setHoveredAvatar(null)}
                  >
                    <span className="member-rank">{index + 1}</span>
                    
                    <div className="avatar-container">
                      <img 
                        src={member.photoURL} 
                        alt={member.name} 
                        className={`member-avatar ${hoveredAvatar === member.uid ? 'avatar-hover' : ''}`}
                      />
                      {onlineUsers.includes(member.uid) && <div className="online-status"></div>}
                      {hoveredAvatar === member.uid && <div className="avatar-tooltip">{member.name}</div>}
                    </div>
                    
                    <div className="member-info">
                      <span className="member-name">{member.name}</span>
                      <span className="member-points">{member.points} نقطة</span>
                    </div>
                    
                    {isCreator && member.uid !== user.uid && (
                      <div className="member-actions">
                        <button 
                          onClick={() => toggleBanMember(member.uid)}
                          className="ban-button"
                          title={bannedMembers.includes(member.uid) ? "إلغاء الحظر" : "حظر العضو"}
                        >
                          {bannedMembers.includes(member.uid) ? "🚫" : "⛔"}
                        </button>
                        <button 
                          onClick={() => removeMember(member.uid)}
                          className="remove-button"
                          title="حذف العضو"
                        >
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                ))
              }
            </div>
            
            {bannedMembers.length > 0 && (
              <div className="banned-section">
                <h4>الأعضاء المحظورين</h4>
                {members
                  .filter(member => bannedMembers.includes(member.uid))
                  .map((member) => (
                    <div key={member.uid} className="member-item banned-member">
                      <div className="avatar-container">
                        <img 
                          src={member.photoURL} 
                          alt={member.name} 
                          className="member-avatar"
                        />
                      </div>
                      
                      <div className="member-info">
                        <span className="member-name">{member.name}</span>
                        <span className="banned-label">محظور</span>
                      </div>
                      
                      {isCreator && (
                        <button 
                          onClick={() => toggleBanMember(member.uid)}
                          className="unban-button"
                        >
                          إلغاء الحظر
                        </button>
                      )}
                    </div>
                  ))
                }
              </div>
            )}
          </>
        )}
      </div>

      {notification && (
        <div className="notification">
          {notification}
        </div>
      )}
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [groupName, setGroupName] = useState('');
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const [notification, setNotification] = useState(null);
  const [activeTab, setActiveTab] = useState('groups');
  const navigate = useNavigate();

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
          .then(registration => {
            console.log('SW registered: ', registration.scope);
          })
          .catch(err => {
            console.log('SW registration failed: ', err);
          });
      });
    }
  }, []);

  const showNotification = (message) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    document.documentElement.setAttribute('data-theme', newMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', JSON.stringify(newMode));
    showNotification(newMode ? '🌙 تم تفعيل الوضع المظلم' : '☀️ تم تفعيل الوضع الفاتح');
  };

  useEffect(() => {
    const savedMode = JSON.parse(localStorage.getItem('darkMode'));
    if (savedMode !== null) {
      setDarkMode(savedMode);
      document.documentElement.setAttribute('data-theme', savedMode ? 'dark' : 'light');
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        const isNewUser = !userDoc.exists();
        
        await userService.createOrUpdateUser(currentUser, {
          firstName: isNewUser ? '' : userDoc.data()?.firstName,
          fatherName: isNewUser ? '' : userDoc.data()?.fatherName,
          lastName: isNewUser ? '' : userDoc.data()?.lastName,
          nickname: isNewUser ? currentUser.displayName || 'مستخدم جديد' : userDoc.data()?.nickname,
          registrationDate: isNewUser ? new Date() : userDoc.data()?.registrationDate
        });
        
        setUser(currentUser);
        await fetchUserGroups(currentUser.uid);
      } else {
        setUser(null);
        setGroups([]);
        setSelectedGroup(null);
      }
    });
    
    return () => unsubscribe();
  }, []);

  const fetchUserGroups = async (userId) => {
    setLoadingGroups(true);
    try {
      const q = query(
        collection(db, "studyGroups"),
        where("members", "array-contains", userId)
      );
      
      const querySnapshot = await getDocs(q);
      const groupsArray = [];
      
      const groupsPromises = querySnapshot.docs.map(async (docSnap) => {
        const groupData = docSnap.data();
        
        if (groupData.bannedMembers?.includes(userId)) {
          return null;
        }
        
        const creatorDoc = await getDoc(doc(db, "users", groupData.creator));
        const creatorName = creatorDoc.exists() ? creatorDoc.data().displayName : "مستخدم غير معروف";
        
        return { 
          id: docSnap.id, 
          ...groupData,
          creatorName,
          code: docSnap.id.slice(0, 6).toUpperCase(),
          isCreator: groupData.creator === userId
        };
      });
      
      const groups = (await Promise.all(groupsPromises)).filter(Boolean);
      setGroups(groups);
      
      if (selectedGroup && !groups.some(g => g.id === selectedGroup)) {
        setSelectedGroup(null);
      }
    } catch (error) {
      console.error("Error fetching user groups:", error);
      showNotification("❌ حدث خطأ أثناء جلب المجموعات");
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      showNotification(`🎉 مرحباً ${result.user.displayName}!`);
    } catch (error) {
      console.error("Error signing in:", error);
      showNotification("❌ حدث خطأ أثناء تسجيل الدخول");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      showNotification("✅ تم تسجيل الخروج بنجاح");
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const addStudyGroup = async () => {
    if (!groupName.trim()) {
      showNotification("⚠️ الرجاء إدخال اسم المجموعة");
      return;
    }
    
    try {
      const newGroup = {
        name: groupName.trim(),
        createdAt: new Date(),
        creator: user.uid,
        members: [user.uid],
        userPoints: { [user.uid]: 0 },
        bannedMembers: []
      };
      
      await addDoc(collection(db, "studyGroups"), newGroup);
      setGroupName('');
      showNotification(`🎉 تم إنشاء مجموعة "${groupName.trim()}" بنجاح`);
      await fetchUserGroups(user.uid);
    } catch (error) {
      console.error("Error adding group:", error);
      showNotification("❌ حدث خطأ أثناء إنشاء المجموعة");
    }
  };

  const deleteGroup = async (groupId) => {
    if (window.confirm("⚠️ هل أنت متأكد من حذف هذه المجموعة؟ سيتم حذف جميع بياناتها نهائياً")) {
      try {
        const groupItem = document.getElementById(`group-${groupId}`);
        if (groupItem) {
          groupItem.style.transform = 'scale(0.9)';
          groupItem.style.opacity = '0.5';
          groupItem.style.transition = 'all 0.3s ease';
          groupItem.style.animation = 'shake 0.5s';
          
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        await deleteDoc(doc(db, "studyGroups", groupId));
        showNotification("✅ تم حذف المجموعة بنجاح");
        await fetchUserGroups(user.uid);
      } catch (error) {
        console.error("Error deleting group:", error);
        showNotification("❌ حدث خطأ أثناء حذف المجموعة");
      }
    }
  };

  const joinGroupByCode = async () => {
    if (!joinCode.trim()) {
      showNotification("⚠️ الرجاء إدخال كود المجموعة");
      return;
    }
    
    try {
      const allGroupsQuery = collection(db, "studyGroups");
      const allGroupsSnapshot = await getDocs(allGroupsQuery);
      
      let groupToJoin = null;
      allGroupsSnapshot.forEach(doc => {
        const groupCode = doc.id.slice(0, 6).toUpperCase();
        if (groupCode === joinCode.toUpperCase().trim()) {
          groupToJoin = { 
            id: doc.id, 
            ...doc.data(),
            code: groupCode
          };
        }
      });
      
      if (groupToJoin) {
        if (groupToJoin.bannedMembers?.includes(user.uid)) {
          showNotification(`🚫 أنت محظور من هذه المجموعة (${groupToJoin.name})`);
          return;
        }
        
        if (groupToJoin.members && groupToJoin.members.includes(user.uid)) {
          setSelectedGroup(groupToJoin.id);
          setShowJoinModal(false);
          setJoinCode('');
          return;
        }
        
        await updateDoc(doc(db, "studyGroups", groupToJoin.id), {
          [`userPoints.${user.uid}`]: 0,
          members: [...(groupToJoin.members || []), user.uid]
        });
        
        setSelectedGroup(groupToJoin.id);
        setShowJoinModal(false);
        setJoinCode('');
        showNotification(`تم الانضمام إلى مجموعة "${groupToJoin.name}"`);
        await fetchUserGroups(user.uid);
      } else {
        showNotification("لا توجد مجموعة بهذا الكود");
      }
    } catch (error) {
      console.error("Error joining group:", error);
      showNotification("حدث خطأ أثناء الانضمام للمجموعة");
    }
  };

  const handleJoinGroup = (groupId) => {
    setSelectedGroup(groupId);
  };

  const handleBackToGroups = () => {
    setSelectedGroup(null);
  };

  if (selectedGroup && user) {
    return (
      <div className="App">
        <Timer 
          user={user} 
          onBack={handleBackToGroups}
          groupId={selectedGroup}
        />
      </div>
    );
  }

  return (
    <div className="App">
      <button 
        onClick={toggleDarkMode} 
        className="theme-toggle"
        aria-label={darkMode ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الغامق'}
      >
        {darkMode ? '☀️' : '🌙'}
      </button>
      
      <Routes>
        <Route path="/" element={
          <>
            <header className="App-header">
              <div className="login-container">
                {!user ? (
                  <div className="welcome-screen">
                    <h1>مجموعات الدراسة التعاونية</h1>
                    <p>انضم إلى مجتمع المذاكرة مع الأصدقاء وحقق أهدافك التعليمية</p>
                    <button className="login-button" onClick={handleLogin}>
                      <span>تسجيل الدخول باستخدام Google</span>
                    </button>
                  </div>
                ) : (
                  <div className="user-welcome">
                    <div className="user-info">
                      <img src={user.photoURL} alt="صورة المستخدم" className="user-avatar" />
                      <div className="user-details">
                        <h2>مرحباً {user.displayName}!</h2>
                        <div className="user-actions">
                          <button 
                            className={`profile-button ${activeTab === 'profile' ? 'active' : ''}`}
                            onClick={() => {
                              setActiveTab('profile');
                              navigate('/profile');
                            }}
                          >
                            الملف الشخصي
                          </button>
                          <button className="logout-button" onClick={handleLogout}>
                            تسجيل الخروج
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {user && activeTab === 'groups' && (
                <>
                  <div className="group-management">
                    <div className="group-creation">
                      <h2>إنشاء مجموعة جديدة</h2>
                      <div className="input-group">
                        <input
                          type="text"
                          value={groupName}
                          onChange={(e) => setGroupName(e.target.value)}
                          placeholder="أدخل اسم المجموعة"
                          onKeyPress={(e) => e.key === 'Enter' && addStudyGroup()}
                        />
                        <button className="create-button" onClick={addStudyGroup}>
                          إنشاء
                        </button>
                      </div>
                    </div>
                    
                    <div className="join-group">
                      <h2>الانضمام إلى مجموعة</h2>
                      <button 
                        className="join-button"
                        onClick={() => setShowJoinModal(true)}
                      >
                        الانضمام بمجموعة موجودة
                      </button>
                    </div>
                  </div>

                  <div className="study-groups">
                    <h2>مجموعاتك الدراسية</h2>
                    
                    {loadingGroups ? (
                      <div className="loading-container">
                        <div className="spinner"></div>
                        <p>جاري تحميل المجموعات...</p>
                      </div>
                    ) : groups.length === 0 ? (
                      <div className="empty-state">
                        <img src="/empty-groups.svg" alt="لا توجد مجموعات" className="empty-image" />
                        <p>لا توجد مجموعات متاحة حالياً</p>
                        <button 
                          className="create-button"
                          onClick={() => document.querySelector('.group-creation input').focus()}
                        >
                          إنشاء مجموعة جديدة
                        </button>
                      </div>
                    ) : (
                      <div className="groups-grid">
                        {groups.map((group) => (
                          <div key={group.id} id={`group-${group.id}`} className="group-card">
                            <div className="group-content">
                              <h3 className="group-name">{group.name}</h3>
                              <p className="group-meta">
                                <span className="group-creator">المنشئ: {group.creatorName}</span>
                                <span className="group-code">كود: {group.code}</span>
                              </p>
                              {group.isCreator && <span className="creator-badge">أنت المنشئ</span>}
                            </div>
                            
                            <div className="group-actions">
                              <button 
                                onClick={() => handleJoinGroup(group.id)} 
                                className="join-button"
                              >
                                دخول المجموعة
                              </button>
                              
                              {group.isCreator && (
                                <button 
                                  onClick={() => deleteGroup(group.id)} 
                                  className="delete-button"
                                >
                                  حذف المجموعة
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
              
              {showJoinModal && (
                <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
                  <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <button className="close-button" onClick={() => setShowJoinModal(false)}>
                      &times;
                    </button>
                    
                    <h2>الانضمام إلى مجموعة</h2>
                    <p>أدخل كود المجموعة المكون من 6 أحرف</p>
                    
                    <input
                      type="text"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder="أدخل كود المجموعة"
                      maxLength={6}
                      className="join-input"
                    />
                    
                    <div className="modal-actions">
                      <button onClick={joinGroupByCode} className="confirm-button">
                        تأكيد الانضمام
                      </button>
                      <button 
                        onClick={() => setShowJoinModal(false)} 
                        className="cancel-button"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {notification && (
                <div className="notification">
                  {notification}
                </div>
              )}

              <footer className="app-footer">
                <p>تم تطويره بواسطة محمد أبو طبيخ © {new Date().getFullYear()}</p>
              </footer>
            </header>
          </>
        } />
        <Route path="/profile" element={<Profile user={user} showNotification={showNotification} />} />
      </Routes>
    </div>
  );
}

export default App;