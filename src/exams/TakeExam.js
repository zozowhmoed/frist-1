import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import ExamService from '../services/ExamService';
import '../styles/exam-styles.css';

const TakeExam = ({ exam, userId, studentName, onComplete }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState(Array(exam.questions.length).fill(null));
  const [timeLeft, setTimeLeft] = useState(exam.duration * 60);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [attemptInfo, setAttemptInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);

  // التحقق من المحاولات السابقة عند تحميل المكون
  useEffect(() => {
    const checkAttempts = async () => {
      try {
        const attemptData = await ExamService.checkExamAttempt(exam.id, userId);
        setAttemptInfo(attemptData);
        
        if (attemptData.attempted) {
          setWarning({
            title: attemptData.canRetake ? "لديك محاولة سابقة" : "لا يمكنك إعادة الامتحان",
            message: attemptData.canRetake 
              ? `لديك محاولة سابقة بنسبة ${attemptData.lastAttempt?.percentage}%. هل تريد المتابعة؟`
              : `لقد استنفذت عدد المحاولات المسموحة (نسبتك: ${attemptData.lastAttempt?.percentage}%)`
          });
        }
      } catch (err) {
        console.error('Error checking exam attempt:', err);
        setError(err.message || 'حدث خطأ أثناء التحقق من المحاولات السابقة');
      } finally {
        setLoading(false);
      }
    };

    checkAttempts();
  }, [exam.id, userId]);

  // مؤقت الامتحان
  useEffect(() => {
    if (timeLeft <= 0 || isSubmitted) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, isSubmitted]);

  // التقديم التلقائي عند انتهاء الوقت
  const handleAutoSubmit = async () => {
    if (isSubmitted) return;
    await handleSubmit();
  };

  // تقديم الامتحان
  const handleSubmit = async () => {
    if (isSubmitted || (attemptInfo?.attempted && !attemptInfo?.canRetake)) return;
    
    try {
      setIsSubmitted(true);
      
      // حساب الإجابات الصحيحة
      const correctAnswers = exam.questions.reduce((count, question, index) => {
        return count + (answers[index] === question.correctAnswer ? (question.points || 1) : 0);
      }, 0);

      // تسجيل النتيجة
      await ExamService.submitExamResult({
        examId: exam.id,
        userId,
        studentName,
        correctAnswers,
        totalQuestions: exam.questions.length,
        passingGrade: exam.passingGrade || Math.ceil(exam.questions.length * 0.6),
        answers: exam.questions.map((q, index) => ({
          questionId: q.id || `q${index}`,
          questionText: q.questionText,
          selectedAnswer: answers[index],
          correctAnswer: q.correctAnswer,
          isCorrect: answers[index] === q.correctAnswer,
          points: q.points || 1
        }))
      });

      // إعلام المكون الأب بانتهاء الامتحان
      onComplete(exam.id, answers);
    } catch (error) {
      console.error('Error submitting exam:', error);
      setError(error.message || 'حدث خطأ أثناء تسليم الاختبار');
      setIsSubmitted(false);
    }
  };

  // الانتقال إلى السؤال التالي
  const goToNextQuestion = () => {
    if (currentQuestionIndex < exam.questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  // الانتقال إلى السؤال السابق
  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  // تغيير الإجابة الحالية
  const handleAnswerChange = (answerIndex) => {
    const newAnswers = [...answers];
    newAnswers[currentQuestionIndex] = answerIndex;
    setAnswers(newAnswers);
  };

  // تنسيق الوقت المتبقي
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (loading) {
    return (
      <div className="exam-loading-container">
        <div className="exam-spinner"></div>
        <p>جاري تحميل الامتحان...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="exam-error-container">
        <h2>حدث خطأ</h2>
        <p>{error}</p>
        <div className="exam-error-actions">
          <button 
            onClick={() => window.location.reload()} 
            className="exam-retry-button"
          >
            إعادة المحاولة
          </button>
          <button 
            onClick={() => onComplete(exam.id, [])} 
            className="exam-back-button"
          >
            العودة
          </button>
        </div>
      </div>
    );
  }

  if (attemptInfo?.attempted && !attemptInfo?.canRetake) {
    return (
      <div className="exam-attempted-container">
        <h2>لا يمكنك أداء الاختبار</h2>
        <div className="attempt-info">
          <p>لقد قمت بأداء هذا الاختبار من قبل</p>
          <p>النسبة: <strong>{attemptInfo.lastAttempt?.percentage || 0}%</strong></p>
          <p>الحالة: <strong>{attemptInfo.lastAttempt?.passed ? 'ناجح' : 'راسب'}</strong></p>
          <p>تاريخ الأداء: {attemptInfo.lastAttempt?.submittedAt?.toLocaleString('ar-EG') || '--'}</p>
        </div>
        <button 
          onClick={() => onComplete(exam.id, [])} 
          className="exam-back-button"
        >
          العودة
        </button>
      </div>
    );
  }

  const currentQuestion = exam.questions[currentQuestionIndex];

  return (
    <div className="exam-container">
      {warning && (
        <div className="exam-warning">
          <h3>{warning.title}</h3>
          <p>{warning.message}</p>
          <button 
            onClick={() => setWarning(null)}
            className="exam-continue-button"
          >
            متابعة
          </button>
        </div>
      )}

      <div className="exam-header">
        <h1 className="exam-title">{exam.title}</h1>
        <div className="exam-timer">
          <span>الوقت المتبقي:</span>
          <span className={timeLeft <= 60 ? "time-warning" : ""}>
            {formatTime(timeLeft)}
          </span>
        </div>
      </div>

      <div className="exam-progress">
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${((currentQuestionIndex + 1) / exam.questions.length) * 100}%` }}
          ></div>
        </div>
        <span>السؤال {currentQuestionIndex + 1} من {exam.questions.length}</span>
      </div>

      <div className="exam-question">
        <h3 className="question-text">{currentQuestion.questionText}</h3>
        {currentQuestion.image && (
          <div className="question-image">
            <img src={currentQuestion.image} alt="صورة السؤال" />
          </div>
        )}
        
        <div className="question-options">
          {currentQuestion.options.map((option, index) => (
            <div 
              key={index}
              className={`option ${answers[currentQuestionIndex] === index ? "selected" : ""}`}
              onClick={() => handleAnswerChange(index)}
            >
              <span className="option-letter">
                {String.fromCharCode(1633 + index)} {/* الحروف العربية (أ، ب، ج، ...) */}
              </span>
              <span className="option-text">{option}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="exam-navigation">
        <button
          onClick={goToPreviousQuestion}
          disabled={currentQuestionIndex === 0}
          className="nav-button prev-button"
        >
          السابق
        </button>

        {currentQuestionIndex < exam.questions.length - 1 ? (
          <button
            onClick={goToNextQuestion}
            disabled={answers[currentQuestionIndex] === null}
            className="nav-button next-button"
          >
            التالي
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitted || answers[currentQuestionIndex] === null}
            className="nav-button submit-button"
          >
            {isSubmitted ? 'جاري التسليم...' : 'تسليم الامتحان'}
          </button>
        )}
      </div>

      <div className="exam-questions-overview">
        {exam.questions.map((_, index) => (
          <div
            key={index}
            className={`question-marker ${
              index === currentQuestionIndex ? "current" : 
              answers[index] !== null ? "answered" : "unanswered"
            }`}
            onClick={() => setCurrentQuestionIndex(index)}
          >
            {index + 1}
          </div>
        ))}
      </div>
    </div>
  );
};

TakeExam.propTypes = {
  exam: PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string,
    duration: PropTypes.number.isRequired,
    questions: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string,
        questionText: PropTypes.string.isRequired,
        options: PropTypes.arrayOf(PropTypes.string).isRequired,
        correctAnswer: PropTypes.number.isRequired,
        points: PropTypes.number,
        image: PropTypes.string
      })
    ).isRequired,
    passingGrade: PropTypes.number,
    allowRetake: PropTypes.bool,
    unlimitedAttempts: PropTypes.bool,
    maxAttempts: PropTypes.number,
    createdAt: PropTypes.instanceOf(Date),
    activatedAt: PropTypes.instanceOf(Date),
    status: PropTypes.oneOf(['draft', 'active', 'archived'])
  }).isRequired,
  userId: PropTypes.string.isRequired,
  studentName: PropTypes.string.isRequired,
  onComplete: PropTypes.func.isRequired
};

export default TakeExam;