import { writeBatch } from 'firebase/firestore';
import { db, collection, query, where, getDocs } from './firebase';

export async function archiveAllWaitingPatients(): Promise<{ archived: number }> {
  const q = query(collection(db, 'patients'), where('statut', '==', 'en_attente'));
  const snap = await getDocs(q);
  if (snap.empty) return { archived: 0 };

  const batch = writeBatch(db);
  snap.docs.forEach((d) => {
    batch.update(d.ref, { statut: 'traite' });
  });
  await batch.commit();
  return { archived: snap.size };
}
