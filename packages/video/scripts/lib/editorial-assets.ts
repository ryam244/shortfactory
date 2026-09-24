/** Original vector artwork; transparent, tightly framed characters and props. */
const ink = '#393B44';
function svg(body: string, box = '0 0 600 760') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}"><g stroke="${ink}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">${body}</g></svg>`;
}
function character(expression: 'think' | 'smile' | 'surprise') {
  const eyes = expression === 'smile'
    ? '<path d="M205 260q20-25 40 0m110 0q20-25 40 0" fill="none"/>'
    : '<ellipse cx="225" cy="260" rx="9" ry="16" fill="#393B44"/><ellipse cx="375" cy="260" rx="9" ry="16" fill="#393B44"/>';
  const mouth = expression === 'surprise' ? '<ellipse cx="300" cy="315" rx="18" ry="25" fill="#E99B89"/>'
    : expression === 'smile' ? '<path d="M267 307q33 50 66 0Z" fill="#E99B89"/>' : '<path d="M278 323q24-12 44 0" fill="none"/>';
  return svg(`<ellipse cx="300" cy="720" rx="195" ry="20" fill="#393B44" opacity=".08" stroke="none"/>
    <path d="M154 312Q79 55 300 54Q525 55 448 352L420 428H174Z" fill="#555064"/>
    <path d="M220 411L201 690H397L380 411Z" fill="#DD775F"/>
    <path d="M210 411L135 495L110 590L171 616L225 486M389 411L465 495L490 590L429 616L375 486" fill="#DD775F"/>
    <path d="M248 388L247 438Q300 477 352 438L351 388" fill="#FFDDC5"/>
    <path d="M155 205Q155 115 300 116Q443 116 445 205L427 318Q396 412 300 413Q204 412 173 318Z" fill="#FFDDC5"/>
    <path d="M146 225Q136 93 302 93Q462 93 451 230Q385 188 354 143Q274 220 146 225Z" fill="#555064"/>
    ${eyes}${mouth}<ellipse cx="197" cy="302" rx="26" ry="12" fill="#EF9C8D" stroke="none"/><ellipse cx="403" cy="302" rx="26" ry="12" fill="#EF9C8D" stroke="none"/>
    <path d="M220 687L210 726H282L286 687M321 687L324 726H398L382 687" fill="#555064"/>
    ${expression === 'think' ? '<path d="M434 565L360 365Q341 336 323 356L311 392L367 582Q401 623 434 565Z" fill="#FFDDC5"/><path d="M201 223l44 11m110 0l40-11" fill="none"/>' : '<path d="M110 590q-21 58 35 49l26-23M490 590q21 58-35 49l-26-23" fill="#FFDDC5"/>'}
    ${expression === 'surprise' ? '<path d="M490 116l26-43m-5 83l44-11" stroke="#DD775F"/>' : ''}`);
}
function background(shop: boolean) {
  return svg(`<rect width="1080" height="1920" fill="${shop ? '#EEE7DA' : '#EDF0E7'}" stroke="none"/>
    <circle cx="870" cy="620" r="410" fill="#FFF8E9" stroke="none"/>
    ${shop ? '<path d="M0 630H1080M0 1080H1080" stroke="#C9BEAB" stroke-width="28"/><g fill="#DD775F" stroke="none"><rect x="50" y="470" width="150" height="140" rx="16"/><rect x="860" y="480" width="160" height="130" rx="16"/></g><g fill="#91B4A4" stroke="none"><rect x="35" y="910" width="180" height="150" rx="18"/><rect x="865" y="870" width="180" height="190" rx="18"/></g>' : '<rect x="70" y="400" width="220" height="310" rx="85" fill="#FFF8E9" stroke="#D0D8C8"/><path d="M960 1140V820m0 170q-130-40-90-130q100 0 90 130m0-20q110-40 90-120q-100 0-90 120" fill="#91B4A4" stroke="#91B4A4"/>'}
    <path d="M0 1490Q540 1400 1080 1490V1920H0Z" fill="#E0D1BA" stroke="none"/>`, '0 0 1080 1920');
}
export const editorialAssets: Record<string, string> = {
  gift_girl: character('smile'), 'gift_girl/think': character('think'), 'gift_girl/smile': character('smile'), 'gift_girl/surprise': character('surprise'),
  shop_shelf: background(true), room_warm: background(false), desk: background(false),
  gift_box: svg('<rect x="65" y="125" width="290" height="225" rx="15" fill="#91B4A4"/><rect x="45" y="95" width="330" height="65" rx="14" fill="#ACCBBD"/><path d="M210 100V350" stroke="#FFF4DE" stroke-width="36"/><path d="M210 96Q63-9 116 48Q160 4 210 96Q278 0 312 50Q348 100 210 96Z" fill="#FFF4DE"/>','0 0 420 420'),
  cookie: svg('<path d="M40 100L75 78L100 100L125 78L150 100L175 78L200 100L225 78L250 100L275 78L300 100L325 78L370 100V325L340 350L315 325L290 350L265 325L240 350L215 325L190 350L165 325L140 350L115 325L85 350L40 325Z" fill="#FFF4DE"/><circle cx="205" cy="216" r="100" fill="#DBA875"/><g fill="#7C5447" stroke="none"><circle cx="172" cy="171" r="13"/><circle cx="251" cy="189" r="14"/><circle cx="215" cy="266" r="15"/><circle cx="154" cy="237" r="12"/></g>','0 0 420 420'),
  card: svg('<rect x="40" y="85" width="340" height="250" rx="18" fill="#FFF9EF"/><path d="M179 145Q151 109 130 148Q115 175 179 216Q244 175 227 148Q207 109 179 145Z" fill="#DD775F" stroke="none"/><path d="M100 259H316M100 292H254" stroke="#C5B8A7"/>','0 0 420 420'),
};
