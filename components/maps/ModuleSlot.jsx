'use client';

import { heeftModule, nietInPakket } from './merk';
import './maps.css';

// Een scherm dat bij een module hoort: zonder die module een korte melding in de plaats.
export default function ModuleSlot({ module, children }) {
  if (heeftModule(module)) return children;
  return (
    <div className="fm" style={{ padding: 32, maxWidth: 560 }}>
      <p style={{ fontSize: 14 }}>{nietInPakket(module)}</p>
      <p className="fm-sub">Vraag de eigenaar van je organisatie om de module toe te voegen.</p>
    </div>
  );
}
