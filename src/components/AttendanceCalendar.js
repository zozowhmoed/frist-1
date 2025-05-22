import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import './AttendanceCalendar.css';

const months = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const daysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();

const AttendanceCalendar = ({ groupId, userId, isCreator }) => {
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const [attendanceData, setAttendanceData] = useState({});
  const [selectedMember, setSelectedMember] = useState(null);
  const [memberDetails, setMemberDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    const savedMode = JSON.parse(localStorage.getItem('darkMode'));
    if (savedMode !== null) {
      setDarkMode(savedMode);
    }
  }, []);

  useEffect(() => {
    const fetchMembers = async () => {
      const groupDoc = await getDoc(doc(db, "studyGroups", groupId));
      if (groupDoc.exists()) {
        const groupData = groupDoc.data();
        const membersList = groupData.members || [];
        
        const membersWithDetails = await Promise.all(
          membersList.map(async (memberId) => {
            const userDoc = await getDoc(doc(db, "users", memberId));
            const userData = userDoc.data() || {};
            return {
              id: memberId,
              firstName: userData.firstName || 'غير معروف',
              fatherName: userData.fatherName || '',
              lastName: userData.lastName || '',
              nickname: userData.nickname || userData.displayName || 'مستخدم',
              photoURL: userData.photoURL || null
            };
          })
        );
        
        setMemberDetails(membersWithDetails);
        
        if (selectedMember) {
          const attendanceDoc = await getDoc(doc(db, "attendance", `${groupId}_${selectedMember}`));
          if (attendanceDoc.exists()) {
            setAttendanceData(attendanceDoc.data().records || {});
          }
        }
      }
      setLoading(false);
    };

    fetchMembers();
  }, [groupId, selectedMember]);

  const changeMonth = (direction) => {
    if (direction === 'prev') {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
  };

  const updateAttendance = async (day, status) => {
    if (!selectedMember) return;
    
    const newData = {
      ...attendanceData,
      [`${currentYear}-${currentMonth}-${day}`]: status
    };
    
    setAttendanceData(newData);
  };

  const deleteAttendance = async (day) => {
    if (!selectedMember) return;
    
    if (window.confirm('هل أنت متأكد من حذف حضور هذا اليوم؟')) {
      const newData = {...attendanceData};
      delete newData[`${currentYear}-${currentMonth}-${day}`];
      
      setAttendanceData(newData);
    }
  };

  const saveChanges = async () => {
    try {
      await setDoc(doc(db, "attendance", `${groupId}_${selectedMember}`), {
        memberId: selectedMember,
        groupId,
        records: attendanceData
      }, { merge: true });
      alert('تم حفظ التعديلات بنجاح');
    } catch (error) {
      console.error('Error saving attendance:', error);
      alert('حدث خطأ أثناء حفظ التعديلات');
    }
  };

  const cancelChanges = async () => {
    const attendanceDoc = await getDoc(doc(db, "attendance", `${groupId}_${selectedMember}`));
    if (attendanceDoc.exists()) {
      setAttendanceData(attendanceDoc.data().records || {});
    } else {
      setAttendanceData({});
    }
  };

  const getSelectedMember = () => {
    return memberDetails.find(m => m.id === selectedMember) || {};
  };

  return (
    <div className="attendance-container" data-theme={darkMode ? 'dark' : 'light'}>
      <h2>جدول الحضور والغياب</h2>
      
      {isCreator && (
        <div className="members-list">
          <h3>اختر عضو:</h3>
          <select 
            onChange={(e) => setSelectedMember(e.target.value)}
            value={selectedMember || ''}
          >
            <option value="">-- اختر عضو --</option>
            {memberDetails.map(member => (
              <option key={member.id} value={member.id}>
                {member.nickname} - {member.firstName} {member.fatherName} {member.lastName}
              </option>
            ))}
          </select>
        </div>
      )}

      {selectedMember && (
        <div className="calendar-container">
          <div className="selected-member-info">
            {getSelectedMember().photoURL && (
              <img 
                src={getSelectedMember().photoURL} 
                alt="صورة العضو" 
                className="member-avatar"
              />
            )}
            <div className="member-names">
              <h3>{getSelectedMember().nickname}</h3>
              <p>
                {getSelectedMember().firstName} 
                {getSelectedMember().fatherName && ` ${getSelectedMember().fatherName}`}
                {getSelectedMember().lastName && ` ${getSelectedMember().lastName}`}
              </p>
            </div>
          </div>

          <div className="calendar-header">
            <button onClick={() => changeMonth('prev')}>◀</button>
            <h3>{months[currentMonth]} {currentYear}</h3>
            <button onClick={() => changeMonth('next')}>▶</button>
          </div>

          <div className="calendar-grid">
            {Array.from({ length: daysInMonth(currentMonth, currentYear) }, (_, i) => {
              const day = i + 1;
              const dateKey = `${currentYear}-${currentMonth}-${day}`;
              const status = attendanceData[dateKey] || 'unset';
              
              return (
                <div 
                  key={day} 
                  className={`calendar-day ${status}`}
                >
                  <span className="day-number">{day}</span>
                  <div className="day-actions">
                    <button 
                      onClick={() => updateAttendance(day, 'present')}
                      className={`present-btn ${status === 'present' ? 'active' : ''}`}
                    >
                      حضور
                    </button>
                    <button 
                      onClick={() => updateAttendance(day, 'absent')}
                      className={`absent-btn ${status === 'absent' ? 'active' : ''}`}
                    >
                      غياب
                    </button>
                    {status !== 'unset' && (
                      <button 
                        onClick={() => deleteAttendance(day)}
                        className="delete-btn"
                      >
                        حذف
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="calendar-actions">
            <button onClick={saveChanges} className="save-btn">حفظ التعديلات</button>
            <button onClick={cancelChanges} className="cancel-btn">إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AttendanceCalendar;