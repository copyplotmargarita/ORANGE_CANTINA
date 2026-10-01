// ============================================================
// Orange Cantina Escolar — productos.service.js
// Servicio de Firestore para la entidad Productos
// ============================================================

import { db, collection, addDoc, getDocs, updateDoc, doc, serverTimestamp } from '../firebase-config.js';

const COLLECTION = 'productos';

/**
 * Crea un nuevo producto.
 */
export async function createProducto(businessId, data) {
    const colRef = collection(db, 'negocios', businessId, COLLECTION);
    const docRef = await addDoc(colRef, {
        ...data,
        createdAt: serverTimestamp()
    });
    return docRef.id;
}

/**
 * Obtiene todos los productos del negocio.
 */
export async function getProductos(businessId) {
    const colRef = collection(db, 'negocios', businessId, COLLECTION);
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

/**
 * Actualiza un producto existente.
 */
export async function updateProducto(businessId, id, data) {
    const docRef = doc(db, 'negocios', businessId, COLLECTION, id);
    await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
    });
}
