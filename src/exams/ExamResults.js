import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import ExamService from '../services/ExamService';
import '../styles/exam-styles.css';

const ExamResults = ({ examId, onBack }) => {
  const [results, setResults] = useState([]);
  const [exam, setExam] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [stats, setStats] = useState({
    totalStudents: 0,
    highestScore: 0,
    lowestScore: 0,
    averageScore: 0,
    passRate: 0
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // جلب بيانات الامتحان
        const examData = await ExamService.getExamById(examId);
        setExam(examData);
        
        // جلب النتائج
        const resultsData = await ExamService.getExamResults(examId);
        setResults(resultsData);
        
        // حساب الإحصائيات
        if (resultsData.length > 0) {
          const scores = resultsData.map(r => r.percentage || 0);
          const highest = Math.max(...scores);
          const lowest = Math.min(...scores);
          const average = Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
          const passed = resultsData.filter(r => r.passed).length;
          
          setStats({
            totalStudents: resultsData.length,
            highestScore: highest,
            lowestScore: lowest,
            averageScore: average,
            passRate: Math.round((passed / resultsData.length) * 100)
          });
        }
      } catch (err) {
        console.error('Failed to load exam results:', err);
        setError('فشل تحميل النتائج. يرجى المحاولة مرة أخرى.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [examId]);

  const exportToCSV = () => {
    if (!results.length) return;
    
    const headers = [
      'الترتيب',
      'اسم الطالب',
      'الدرجة',
      'النسبة المئوية',
      'الحالة',
      'تاريخ التسليم'
    ].join(',');
    
    const rows = results.map((result, index) => [
      index + 1,
      result.studentName,
      result.correctAnswers,
      `${result.percentage}%`,
      result.passed ? 'ناجح' : 'راسب',
      result.submittedAt?.toLocaleString('ar-EG') || '--'
    ].join(','));
    
    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `نتائج_${exam?.title || 'امتحان'}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>جاري تحميل النتائج...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h3>حدث خطأ</h3>
        <p>{error}</p>
        <button onClick={onBack} className="back-button">
          العودة للخلف
        </button>
      </div>
    );
  }

  return (
    <div className="exam-results-container">
      <button onClick={onBack} className="back-button">
        &larr; العودة إلى قائمة الامتحانات
      </button>
      
      <h2>نتائج الامتحان: {exam?.title || 'غير معروف'}</h2>
      
      {results.length === 0 ? (
        <div className="no-results">
          <img src="/no-results.svg" alt="لا توجد نتائج" />
          <p>لا توجد نتائج متاحة بعد</p>
        </div>
      ) : (
        <>
          <div className="stats-summary">
            <div className="stat-card">
              <span className="stat-value">{stats.totalStudents}</span>
              <span className="stat-label">عدد الطلاب</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.highestScore}%</span>
              <span className="stat-label">أعلى نسبة</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.lowestScore}%</span>
              <span className="stat-label">أقل نسبة</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.averageScore}%</span>
              <span className="stat-label">المتوسط</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.passRate}%</span>
              <span className="stat-label">معدل النجاح</span>
            </div>
          </div>
          
          <div className="results-actions">
            <button onClick={exportToCSV} className="export-btn">
              تصدير النتائج (CSV)
            </button>
          </div>
          
          <div className="results-table-container">
            <table className="results-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>اسم الطالب</th>
                  <th>الإجابات الصحيحة</th>
                  <th>النسبة</th>
                  <th>الحالة</th>
                  <th>وقت التسليم</th>
                </tr>
              </thead>
              <tbody>
                {results.map((result, index) => (
                  <tr key={result.id}>
                    <td>{index + 1}</td>
                    <td>{result.studentName}</td>
                    <td>{result.correctAnswers}/{result.totalQuestions}</td>
                    <td>{result.percentage}%</td>
                    <td>
                      <span className={`status-badge ${result.passed ? 'passed' : 'failed'}`}>
                        {result.passed ? 'ناجح' : 'راسب'}
                      </span>
                    </td>
                    <td>
                      {result.submittedAt?.toLocaleString('ar-EG') || '--'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

ExamResults.propTypes = {
  examId: PropTypes.string.isRequired,
  onBack: PropTypes.func.isRequired
};

export default ExamResults;