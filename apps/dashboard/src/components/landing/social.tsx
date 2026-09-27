import { ChevronDown, Star } from 'lucide-react';
import { FAQS, TESTIMONIALS } from './data';

export function Testimonials() {
    return (
        <section className="section" id="community" style={{ paddingTop: 0 }}>
            <div className="wrap">
                <div className="secHead center">
                    <div className="kicker">Community</div>
                    <h2>Loved by server teams.</h2>
                    <p className="secSub">
                        Owners and admins choose MasterBot for control, reliability
                        and a dashboard that feels like a real product.
                    </p>
                </div>

                <div className="quotes">
                    {TESTIMONIALS.map((t) => (
                        <figure className="quote" key={t.name}>
                            <div className="stars">
                                {Array.from({ length: 5 }).map((_, i) => (
                                    <Star key={i} size={12} fill="currentColor" />
                                ))}
                            </div>
                            <p>&ldquo;{t.quote}&rdquo;</p>
                            <figcaption className="quoteWho">
                                <span className="quoteAv">{t.initials}</span>
                                <div>
                                    <b>{t.name}</b>
                                    <small>{t.role}</small>
                                </div>
                            </figcaption>
                        </figure>
                    ))}
                </div>
            </div>
        </section>
    );
}

export function Faq() {
    return (
        <section className="section" id="faq" style={{ paddingTop: 0 }}>
            <div className="wrap">
                <div className="secHead center">
                    <div className="kicker">FAQ</div>
                    <h2>Questions, answered.</h2>
                </div>

                <div className="faq">
                    {FAQS.map((f) => (
                        <details className="qa" key={f.q}>
                            <summary>
                                {f.q}
                                <ChevronDown size={15} />
                            </summary>
                            <div className="qaBody">{f.a}</div>
                        </details>
                    ))}
                </div>
            </div>
        </section>
    );
}
