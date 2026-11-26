// Generates a VAPID key pair for Web Push (RFC 8292) with node:crypto only; writes nothing to disk.
// Public key: uncompressed P-256 point (65 bytes), base64url → VAPID_PUBLIC_KEY (and VITE_VAPID_PUBLIC_KEY).
// Private key: the 32-byte scalar, base64url → qr-vapid-private in Secret Manager (VAPID_PRIVATE_KEY). Never commit it.
// Usage: node scripts/gen-vapid.ts [--json]
import { generateKeyPairSync } from 'node:crypto';

export function generateVapidKeys(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const pub = publicKey.export({ format: 'jwk' });
  const priv = privateKey.export({ format: 'jwk' });
  if (!pub.x || !pub.y || !priv.d) throw new Error('unexpected key format');
  // JWK members are base64url without padding; x, y and d are fixed at 32 bytes for P-256.
  const point = Buffer.concat([Buffer.from([0x04]), Buffer.from(pub.x, 'base64url'), Buffer.from(pub.y, 'base64url')]);
  return { publicKey: point.toString('base64url'), privateKey: priv.d };
}

if (import.meta.main) {
  const keys = generateVapidKeys();
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(keys));
  } else {
    console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
    console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
    console.error(
      '\nA chave pública vai para a variável VAPID_PUBLIC_KEY (GitHub). A privada vai só para o segredo qr-vapid-private.\nNada foi gravado em arquivo; guarde a privada agora.',
    );
  }
}
