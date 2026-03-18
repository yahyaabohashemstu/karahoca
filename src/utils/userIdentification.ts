/**
 * نظام تتبع المستخدمين المتقدم
 * يدمج localStorage + Device Fingerprinting للتعرف على الزوار
 */

import FingerprintJS from '@fingerprintjs/fingerprintjs';

// مفتاح localStorage
const USER_ID_KEY = 'karahoca_user_id';
const FINGERPRINT_KEY = 'karahoca_fingerprint';

/**
 * الحصول على Device Fingerprint (معرّف فريد للجهاز)
 */
export const getDeviceFingerprint = async (): Promise<string> => {
  try {
    // التحقق من وجود fingerprint محفوظ
    const cachedFingerprint = localStorage.getItem(FINGERPRINT_KEY);
    if (cachedFingerprint) {
      return cachedFingerprint;
    }

    // إنشاء fingerprint جديد
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    const fingerprint = result.visitorId;

    // حفظه في localStorage للأداء
    localStorage.setItem(FINGERPRINT_KEY, fingerprint);
    
    return fingerprint;
  } catch (error) {
    console.error('❌ Error getting device fingerprint:', error);
    // fallback: إنشاء معرّف عشوائي
    const fallbackId = `fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return fallbackId;
  }
};

/**
 * الحصول على أو إنشاء معرّف المستخدم
 * النظام المتقدم: localStorage + Fingerprinting
 */
export const getOrCreateUserId = async (): Promise<string> => {
  try {
    // المحاولة 1: البحث في localStorage
    let userId = localStorage.getItem(USER_ID_KEY);
    
    if (userId) {
      console.log('✅ Found existing user ID:', userId);
      return userId;
    }

    // المحاولة 2: استخدام Device Fingerprint
    const fingerprint = await getDeviceFingerprint();
    
    // إنشاء userId جديد باستخدام fingerprint
    // التنسيق: visitor_<fingerprint>_<timestamp>
    const timestamp = Date.now();
    userId = `visitor_${fingerprint}_${timestamp}`;
    
    // حفظه في localStorage
    localStorage.setItem(USER_ID_KEY, userId);
    
    console.log('🆕 Created new user ID:', userId);
    console.log('🔐 Device Fingerprint:', fingerprint);
    
    return userId;
  } catch (error) {
    console.error('❌ Error in getOrCreateUserId:', error);
    
    // Fallback: معرّف بسيط
    const fallbackUserId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(USER_ID_KEY, fallbackUserId);
    
    return fallbackUserId;
  }
};

/**
 * الحصول على userId الحالي (بدون إنشاء جديد)
 */
export const getCurrentUserId = (): string | null => {
  return localStorage.getItem(USER_ID_KEY);
};

/**
 * تحديث userId (عند تسجيل الدخول مثلاً)
 * يربط المحادثات القديمة بالحساب الجديد
 */
export const updateUserId = (newUserId: string): void => {
  const oldUserId = getCurrentUserId();
  
  if (oldUserId && oldUserId !== newUserId) {
    console.log('🔄 Updating user ID:', oldUserId, '→', newUserId);
    // TODO: إرسال طلب للـ Backend لربط المحادثات القديمة
  }
  
  localStorage.setItem(USER_ID_KEY, newUserId);
};

/**
 * مسح معرّف المستخدم (للاختبار)
 */
export const clearUserId = (): void => {
  localStorage.removeItem(USER_ID_KEY);
  localStorage.removeItem(FINGERPRINT_KEY);
  console.log('🗑️ User ID cleared');
};

/**
 * الحصول على معلومات المستخدم الكاملة
 */
export const getUserInfo = async () => {
  const userId = await getOrCreateUserId();
  const fingerprint = await getDeviceFingerprint();
  const isVisitor = userId.startsWith('visitor_');
  
  return {
    userId,
    fingerprint,
    isVisitor,
    userType: isVisitor ? 'زائر' : 'مستخدم مسجّل',
    createdAt: userId.split('_').pop() // استخراج timestamp
  };
};
