import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import ExamService from '../../services/ExamService';
import '../../styles/exam-styles.css';

const ExamsList = ({ 
  exams, 
  isCreator, 
  currentUserId,
  onActivateExam,
  onDeleteExam,
  onStartCreate,
  onViewResults,
  onTakeExam
}) => {
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const filteredExams = exams.filter(exam => {
    if (filter === 'active') return exam.status === 'active';
    if (filter === 'draft') return exam.status === 'draft';
    if (filter === 'mine') return exam.creatorId === currentUserId;
    return true;
  });

  const handleActivate = async (examId) => {
    try {
      setLoading(true);
      await onActivateExam(examId);
    } catch (err) {
      console.error('Error activating exam:', err);
      setError('حدث خطأ أثناء تفعيل الامتحان');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (examId) => {
    if (window.confirm('هل أنت متأكد من حذف هذا الامتحان؟ سيتم حذف جميع النتائج المرتبطة به.')) {
      try {
        setLoading(true);
        await onDeleteExam(examId);
      } catch (err) {
        console.error('Error deleting exam:', err);
        setError('حدث خطأ أثناء حذف الامتحان');
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="exams-list-container">
      <div className="exams-header">
        <h2>قائمة الامتحانات</h2>
        
        <div className="exams-controls">
          <div className="filter-control">
            <label>تصفية:</label>
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">الكل</option>
              <option value="active">نشطة</option>
              <option value="draft">مسودة</option>
              {isCreator && <option value="mine">التي أنشأتها</option>}
            </select>
          </div>
          
          {isCreator && (
            <button onClick={onStartCreate} className="create-exam-btn">
              إنشاء امتحان جديد
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
        </div>
      )}

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>إغلاق</button>
        </div>
      )}

      {filteredExams.length === 0 ? (
        <div className="no-exams">
          <img src="/no-exams.svg" alt="لا توجد امتحانات" />
          <p>لا توجد امتحانات متاحة</p>
          {isCreator && (
            <button onClick={onStartCreate} className="create-exam-btn">
              إنشاء أول امتحان
            </button>
          )}
        </div>
      ) : (
        <div className="exams-grid">
          {filteredExams.map(exam => (
            <div key={exam.id} className={`exam-card ${exam.status}`}>
              <div className="exam-header">
                <h3>{exam.title}</h3>
                <span className={`exam-status ${exam.status}`}>
                  {exam.status === 'active' ? 'نشط' : 'مسودة'}
                </span>
              </div>
              
              <div className="exam-meta">
                <p><strong>عدد الأسئلة:</strong> {exam.questions?.length || 0}</p>
                <p><strong>المدة:</strong> {exam.duration} دقيقة</p>
                <p><strong>درجة النجاح:</strong> {exam.passingGrade || 60}%</p>
                {exam.activatedAt && (
                  <p><strong>تاريخ التفعيل:</strong> {exam.activatedAt.toLocaleString('ar-EG')}</p>
                )}
              </div>
              
              <div className="exam-actions">
                {exam.status === 'active' ? (
                  <>
                    <button 
                      onClick={() => onTakeExam(exam)} 
                      className="take-exam-btn"
                    >
                      أداء الامتحان
                    </button>
                    
                    {isCreator && (
                      <button 
                        onClick={() => onViewResults(exam)} 
                        className="view-results-btn"
                      >
                        عرض النتائج
                      </button>
                    )}
                  </>
                ) : isCreator && exam.creatorId === currentUserId ? (
                  <>
                    <button 
                      onClick={() => handleActivate(exam.id)} 
                      className="activate-exam-btn"
                    >
                      تفعيل الامتحان
                    </button>
                    <button 
                      onClick={() => handleDelete(exam.id)} 
                      className="delete-exam-btn"
                    >
                      حذف
                    </button>
                  </>
                ) : (
                  <p className="not-available">غير متاح حالياً</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

ExamsList.propTypes = {
  exams: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      title: PropTypes.string.isRequired,
      status: PropTypes.string.isRequired,
      duration: PropTypes.number.isRequired,
      passingGrade: PropTypes.number,
      questions: PropTypes.array.isRequired,
      creatorId: PropTypes.string.isRequired,
      activatedAt: PropTypes.instanceOf(Date),
      createdAt: PropTypes.instanceOf(Date)
    })
  ).isRequired,
  isCreator: PropTypes.bool.isRequired,
  currentUserId: PropTypes.string.isRequired,
  onActivateExam: PropTypes.func.isRequired,
  onDeleteExam: PropTypes.func.isRequired,
  onStartCreate: PropTypes.func.isRequired,
  onViewResults: PropTypes.func.isRequired,
  onTakeExam: PropTypes.func.isRequired
};

export default ExamsList;