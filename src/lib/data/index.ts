import { isDemoMode } from '@/lib/firebase';
import { demoDataSource } from './demo';
import { firestoreDataSource } from './firestore';
import type { DataSource } from './types';

export * from './types';

// בחירת מקור נתונים: Firestore כשמפתחות Firebase מוגדרים, אחרת דמו מקומי.
// אתחול Firebase עצמו עצל, כך שבמצב דמו הוא לא מופעל כלל.
export function getDataSource(): DataSource {
  return isDemoMode ? demoDataSource : firestoreDataSource;
}
