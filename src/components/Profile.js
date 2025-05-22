import React, { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useNavigate } from 'react-router-dom';
import './Profile.css';

function Profile({ user, showNotification, onBack }) {
  const [profile, setProfile] = useState({
    firstName: '',
    fatherName: '',
    lastName: ''
  });
  
  const navigate = useNavigate();

  useEffect(() => {
    const loadProfile = async () => {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        setProfile({
          firstName: userDoc.data().firstName || '',
          fatherName: userDoc.data().fatherName || '',
          lastName: userDoc.data().lastName || ''
        });
      }
    };
    loadProfile();
  }, [user]);

  const handleSave = async () => {
    try {
      await updateDoc(doc(db, "users", user.uid), profile);
      showNotification('تم حفظ التعديلات بنجاح');
      if (onBack) {
        onBack();
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error("Error updating profile:", error);
      showNotification('حدث خطأ أثناء حفظ التعديلات');
    }
  };

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      navigate('/');
    }
  };

  return (
    <div className="profile-container">
      <div className="profile-form">
        <h2>تعديل الملف الشخصي</h2>
        
        <div className="form-group">
          <label>الاسم الأول:</label>
          <input 
            value={profile.firstName}
            onChange={(e) => setProfile({...profile, firstName: e.target.value})}
            placeholder="أدخل الاسم الأول"
          />
        </div>
        
        <div className="form-group">
          <label>اسم الأب:</label>
          <input 
            value={profile.fatherName}
            onChange={(e) => setProfile({...profile, fatherName: e.target.value})}
            placeholder="أدخل اسم الأب"
          />
        </div>
        
        <div className="form-group">
          <label>اسم العائلة:</label>
          <input 
            value={profile.lastName}
            onChange={(e) => setProfile({...profile, lastName: e.target.value})}
            placeholder="أدخل اسم العائلة"
          />
        </div>
        
        <div className="profile-actions">
          <button onClick={handleSave} className="save-button">
            حفظ التعديلات
          </button>
          
          <button 
            onClick={handleBack} 
            className="back-button"
          >
            الرجوع إلى الصفحة الرئيسية
          </button>
        </div>
      </div>
    </div>
  );
}

export default Profile;