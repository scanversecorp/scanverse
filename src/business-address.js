/** ScanV Corp registered / virtual office — Gera Imperium Gateway, PCMC. */
export const SCANV_OFFICE = {
  building: 'Gera Imperium Gateway',
  street: 'C.T.S. No. 2656(P), Nashik Phata Flyover, Opp. Bhosari Metro Station',
  locality: 'Bhosari, Pimpri-Chinchwad',
  city: 'Pune',
  region: 'Maharashtra',
  pin: '411034',
  country: 'IN',
  lat: 18.6094,
  lng: 73.8201,
};

export const SCANV_OFFICE_LINE =
  `${SCANV_OFFICE.building}, ${SCANV_OFFICE.street}, ${SCANV_OFFICE.locality}, ${SCANV_OFFICE.city} ${SCANV_OFFICE.pin}, ${SCANV_OFFICE.region}`;

export const SCANV_MAPS_URL =
  'https://www.google.com/maps/search/?api=1&query=Gera+Imperium+Gateway,+Nashik+Phata,+Bhosari,+Pune,+411034';

export const SCANV_MAPS_EMBED_URL =
  `https://www.google.com/maps?q=${SCANV_OFFICE.lat},${SCANV_OFFICE.lng}&z=16&output=embed`;

/** schema.org PostalAddress object for JSON-LD. */
export const SCANV_POSTAL_ADDRESS_LD = {
  '@type': 'PostalAddress',
  streetAddress: `${SCANV_OFFICE.building}, ${SCANV_OFFICE.street}`,
  addressLocality: SCANV_OFFICE.locality,
  addressRegion: SCANV_OFFICE.region,
  postalCode: SCANV_OFFICE.pin,
  addressCountry: SCANV_OFFICE.country,
};
