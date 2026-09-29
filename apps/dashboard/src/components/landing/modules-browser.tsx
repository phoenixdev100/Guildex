'use client';

import { useState } from 'react';
import { MODULE_CATEGORIES, MODULES } from './data';
import type { ModuleCategory } from './data';

type Cat = 'All' | ModuleCategory;

export function ModulesBrowser() {
    const [cat, setCat] = useState<Cat>('All');
    const list = cat === 'All' ? MODULES : MODULES.filter((m) => m.cat === cat);
    const count = (c: Cat) => (c === 'All' ? MODULES.length : MODULES.filter((m) => m.cat === c).length);

    return (
        <>
            <div className="modTabs" role="tablist" aria-label="Module categories">
                {MODULE_CATEGORIES.map((c) => (
                    <button
                        key={c}
                        role="tab"
                        aria-selected={cat === c}
                        className={`modTab ${cat === c ? 'on' : ''}`}
                        onClick={() => setCat(c)}
                    >
                        {c}
                        <span>{count(c)}</span>
                    </button>
                ))}
            </div>

            <div className="modGrid">
                {list.map(({ name, desc, icon: Icon, cat }) => (
                    <div className="mod" key={name}>
                        <div className="modTop">
                            <span className="modIcon"><Icon size={15} /></span>
                            <span className="modCat">{cat}</span>
                        </div>
                        <b>{name}</b>
                        <small>{desc}</small>
                    </div>
                ))}
            </div>
        </>
    );
}
