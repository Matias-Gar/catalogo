import { v4 as uuidv4 } from 'uuid';
import { getBrowserItem, setBrowserItem } from './browserStorage';

// Utilidad global para token anónimo de carrito
let carritoToken: string | null = null;

export function getCarritoToken(): string | null {
  if (typeof window === 'undefined') return null;
  if (!carritoToken) {
    carritoToken = getBrowserItem('carrito_token') || uuidv4();
    setBrowserItem('carrito_token', carritoToken);
  }
  return carritoToken;
}
