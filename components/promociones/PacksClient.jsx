"use client";

import { useState } from "react";

export default function PacksClient({ initialPacks = [] }) {
  const [packs, setPacks] = useState(initialPacks);

  return (
    <section>
      {/* UI ligera; mover cualquier useEffect, eventos o imports cliente aquí */}
      <ul className="space-y-2">
        {packs.map((p) => (
          <li key={p.id} className="bg-gray-900 text-white p-2 rounded">
            {p.nombre || p.title || `Pack ${p.id}`}
          </li>
        ))}
      </ul>
    </section>
  );
}
