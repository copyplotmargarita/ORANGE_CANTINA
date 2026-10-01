// ============================================================
// Orange Cantina Escolar — representantes.service.js
// Servicio de Firestore para la entidad Representantes
// ============================================================

import { db, collection, addDoc, getDocs, updateDoc, doc, serverTimestamp } from '../firebase-config.js';

const COLLECTION = 'representantes';

/**
 * Crea un nuevo representante.
 */
export async function createRepresentante(businessId, data) {
    const colRef = collection(db, 'negocios', businessId, COLLECTION);
    const docRef = await addDoc(colRef, {
        ...data,
        createdAt: serverTimestamp()
    });
    return docRef.id;
}

/**
 * Obtiene todos los representantes del negocio.
 */
export async function getRepresentantes(businessId) {
    const colRef = collection(db, 'negocios', businessId, COLLECTION);
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Actualiza un representante existente.
 */
export async function updateRepresentante(businessId, id, data) {
    const docRef = doc(db, 'negocios', businessId, COLLECTION, id);
    await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
    });
}

/**
 * Busca representantes por texto libre (nombre o teléfono).
 * En MVP hacemos filtrado en memoria ya que Firestore no soporta Full-Text Search nativo fácilmente.
 */
export async function buscarRepresentante(businessId, queryText) {
    const all = await getRepresentantes(businessId);
    if (!queryText) return all;
    
    const q = queryText.toLowerCase().trim();
    return all.filter(r => 
        (r.nombre && r.nombre.toLowerCase().includes(q)) || 
        (r.telefono && r.telefono.includes(q))
    );
}
