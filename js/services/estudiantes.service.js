// ============================================================
// Orange Cantina Escolar — estudiantes.service.js
// Servicio de Firestore para la entidad Estudiantes
// ============================================================

import { db, collection, addDoc, getDoc, getDocs, updateDoc, deleteDoc, doc, serverTimestamp } from '../firebase-config.js';

const COLLECTION = 'estudiantes';

/**
 * Crea un nuevo estudiante con saldos iniciales en cero.
 */
export async function createEstudiante(businessId, data) {
    const colRef = collection(db, 'negocios', businessId, COLLECTION);
    const docRef = await addDoc(colRef, {
        ...data,
        walletSaldoUSD: 0,
        estadoCuentaUSD: 0,
        createdAt: serverTimestamp()
    });
    return docRef.id;
}

/**
 * Obtiene todos los estudiantes del negocio.
 */
export async function getEstudiantes(businessId) {
    const colRef = collection(db, 'negocios', businessId, COLLECTION);
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Obtiene un estudiante por ID.
 */
export async function getEstudianteById(businessId, id) {
    const docRef = doc(db, 'negocios', businessId, COLLECTION, id);
    const snapshot = await getDoc(docRef);
    if (snapshot.exists()) {
        return { id: snapshot.id, ...snapshot.data() };
    }
    return null;
}

/**
 * Actualiza un estudiante existente.
 */
export async function updateEstudiante(businessId, id, data) {
    const docRef = doc(db, 'negocios', businessId, COLLECTION, id);
    await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
    });
}

/**
 * Elimina un estudiante. Verifica primero que no tenga deuda.
 */
export async function deleteEstudiante(businessId, id) {
    const estudiante = await getEstudianteById(businessId, id);
    if (!estudiante) throw new Error('Estudiante no encontrado');
    
    if (estudiante.estadoCuentaUSD > 0) {
        throw new Error('No se puede eliminar un estudiante con deuda pendiente.');
    }

    const docRef = doc(db, 'negocios', businessId, COLLECTION, id);
    await deleteDoc(docRef);
    
    // NOTA PARA FASES FUTURAS: Aquí iría el borrado en cascada (ventas, pagos)
    // usando Cloud Functions o un Batch Write de Firestore.
}
