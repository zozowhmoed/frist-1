import { db } from './firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc,
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  Timestamp
} from 'firebase/firestore';

const ExamService = {
  // إنشاء امتحان جديد
  createExam: async (examData) => {
    try {
      const examWithTimestamp = {
        ...examData,
        createdAt: Timestamp.now(),
        status: 'draft',
        active: false
      };
      const docRef = await addDoc(collection(db, "exams"), examWithTimestamp);
      return docRef.id;
    } catch (error) {
      console.error("Error creating exam:", error);
      throw new Error("حدث خطأ أثناء إنشاء الامتحان");
    }
  },

  // تفعيل الامتحان
  activateExam: async (examId) => {
    try {
      await updateDoc(doc(db, "exams", examId), {
        status: 'active',
        activatedAt: Timestamp.now(),
        active: true
      });
    } catch (error) {
      console.error("Error activating exam:", error);
      throw new Error("حدث خطأ أثناء تفعيل الامتحان");
    }
  },

  // الحصول على امتحان بواسطة ID
  getExamById: async (examId) => {
    try {
      const docSnap = await getDoc(doc(db, "exams", examId));
      if (docSnap.exists()) {
        return {
          id: docSnap.id,
          ...docSnap.data(),
          createdAt: docSnap.data().createdAt?.toDate(),
          activatedAt: docSnap.data().activatedAt?.toDate()
        };
      }
      return null;
    } catch (error) {
      console.error("Error getting exam:", error);
      throw new Error("حدث خطأ أثناء جلب بيانات الامتحان");
    }
  },

  // الحصول على جميع الامتحانات لمجموعة معينة
  getExamsForGroup: async (groupId) => {
    try {
      const q = query(collection(db, "exams"), where("groupId", "==", groupId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        activatedAt: doc.data().activatedAt?.toDate()
      }));
    } catch (error) {
      console.error("Error fetching exams:", error);
      throw new Error("حدث خطأ أثناء جلب قائمة الامتحانات");
    }
  },

  // حذف امتحان
  deleteExam: async (examId) => {
    try {
      const batch = writeBatch(db);
      
      // حذف النتائج المرتبطة بالامتحان
      const resultsQuery = query(collection(db, "examResults"), where("examId", "==", examId));
      const resultsSnapshot = await getDocs(resultsQuery);
      resultsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // حذف الامتحان نفسه
      batch.delete(doc(db, "exams", examId));
      
      await batch.commit();
    } catch (error) {
      console.error("Error deleting exam:", error);
      throw new Error("حدث خطأ أثناء حذف الامتحان");
    }
  },

  // التحقق من المحاولات السابقة للامتحان
  checkExamAttempt: async (examId, userId) => {
    try {
      const resultsRef = collection(db, "examResults");
      const q = query(
        resultsRef,
        where("examId", "==", examId),
        where("userId", "==", userId)
      );
      
      const querySnapshot = await getDocs(q);
      const attempts = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().submittedAt?.toDate()
      }));

      // الحصول على بيانات الامتحان
      const examDoc = await getDoc(doc(db, "exams", examId));
      if (!examDoc.exists()) {
        throw new Error("الامتحان غير موجود");
      }
      
      const examData = examDoc.data();
      
      return {
        attempted: attempts.length > 0,
        lastAttempt: attempts[0],
        canRetake: examData.unlimitedAttempts || 
                 (examData.allowRetake && attempts.length < (examData.maxAttempts || 1))
      };
    } catch (error) {
      console.error("Error checking exam attempt:", error);
      throw new Error("حدث خطأ أثناء التحقق من المحاولات السابقة");
    }
  },

  // تسليم نتيجة الامتحان
  submitExamResult: async (resultData) => {
    try {
      const examDoc = await getDoc(doc(db, "exams", resultData.examId));
      if (!examDoc.exists()) {
        throw new Error("الامتحان غير موجود");
      }
      
      const examData = examDoc.data();
      const totalQuestions = resultData.totalQuestions || examData.questions?.length || 0;
      const correctAnswers = resultData.correctAnswers || 0;
      const passingGrade = resultData.passingGrade || examData.passingGrade || Math.ceil(totalQuestions * 0.6);
      
      const resultWithDetails = {
        ...resultData,
        examTitle: examData.title,
        totalQuestions,
        correctAnswers,
        passingGrade,
        percentage: Math.round((correctAnswers / totalQuestions) * 100),
        passed: correctAnswers >= passingGrade,
        submittedAt: Timestamp.now(),
        userId: resultData.userId,
        studentName: resultData.studentName || "مستخدم غير معروف"
      };
      
      const docRef = await addDoc(collection(db, "examResults"), resultWithDetails);
      return docRef.id;
    } catch (error) {
      console.error("Error submitting exam result:", error);
      throw new Error("حدث خطأ أثناء تسليم نتيجة الامتحان");
    }
  },

  // الحصول على نتائج الامتحان
  getExamResults: async (examId) => {
    try {
      const q = query(collection(db, "examResults"), where("examId", "==", examId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        submittedAt: doc.data().submittedAt?.toDate()
      }));
    } catch (error) {
      console.error("Error fetching exam results:", error);
      throw new Error("حدث خطأ أثناء جلب نتائج الامتحان");
    }
  },

  // تحديث بيانات الامتحان
  updateExam: async (examId, updates) => {
    try {
      await updateDoc(doc(db, "exams", examId), updates);
    } catch (error) {
      console.error("Error updating exam:", error);
      throw new Error("حدث خطأ أثناء تحديث بيانات الامتحان");
    }
  }
};

export default ExamService;