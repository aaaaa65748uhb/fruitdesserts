'use client';

import { useState } from 'react';

interface ContactForm {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export default function ContactPage() {
  const [form, setForm] = useState<ContactForm>({ name: '', email: '', subject: '', message: '' });
  const [errors, setErrors] = useState<Partial<ContactForm>>({});
  const [sent, setSent] = useState(false);

  const setField = (field: keyof ContactForm, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validation: Partial<ContactForm> = {};
    if (form.name.trim().length < 2) validation.name = 'נא להזין שם';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      validation.email = 'נא להזין אימייל תקין';
    }
    if (form.message.trim().length < 5) validation.message = 'נא לכתוב לנו כמה מילים';
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;
    setSent(true);
  };

  if (sent) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <span className="inline-block animate-pop text-8xl">💌</span>
        <h1 className="mt-6 font-display text-3xl font-black">ההודעה נשלחה!</h1>
        <p className="mt-3 text-squid-ink/60">
          תודה {form.name}! נחזור אליכם תוך יום עסקים אחד לכתובת {form.email}
        </p>
        <button onClick={() => { setSent(false); setForm({ name: '', email: '', subject: '', message: '' }); }} className="btn-secondary mt-8">
          שליחת הודעה נוספת
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="font-display text-4xl font-black">יצירת קשר 💬</h1>
      <p className="mt-2 text-squid-ink/60">יש שאלה? רעיון? רק בא לכם להגיד שלום? אנחנו כאן!</p>

      <div className="mt-10 grid gap-8 md:grid-cols-[1fr_320px]">
        <form onSubmit={handleSubmit} className="card space-y-4 p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="contact-name" className="mb-1 block font-bold">שם מלא *</label>
              <input
                id="contact-name"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="ישראל ישראלי"
                className={`input-field ${errors.name ? 'input-error' : ''}`}
              />
              {errors.name && <p className="mt-1 text-sm font-bold text-squid-pink-dark">{errors.name}</p>}
            </div>
            <div>
              <label htmlFor="contact-email" className="mb-1 block font-bold">אימייל *</label>
              <input
                id="contact-email"
                type="email"
                dir="ltr"
                value={form.email}
                onChange={(e) => setField('email', e.target.value)}
                placeholder="israel@example.com"
                className={`input-field ${errors.email ? 'input-error' : ''}`}
              />
              {errors.email && <p className="mt-1 text-sm font-bold text-squid-pink-dark">{errors.email}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="contact-subject" className="mb-1 block font-bold">נושא</label>
            <select
              id="contact-subject"
              value={form.subject}
              onChange={(e) => setField('subject', e.target.value)}
              className="input-field"
            >
              <option value="">בחרו נושא...</option>
              <option value="order">שאלה על הזמנה</option>
              <option value="product">שאלה על מוצר</option>
              <option value="shipping">משלוחים והחזרות</option>
              <option value="collab">שיתופי פעולה</option>
              <option value="other">אחר</option>
            </select>
          </div>

          <div>
            <label htmlFor="contact-message" className="mb-1 block font-bold">ההודעה שלכם *</label>
            <textarea
              id="contact-message"
              rows={5}
              value={form.message}
              onChange={(e) => setField('message', e.target.value)}
              placeholder="ספרו לנו הכל..."
              className={`input-field resize-none ${errors.message ? 'input-error' : ''}`}
            />
            {errors.message && <p className="mt-1 text-sm font-bold text-squid-pink-dark">{errors.message}</p>}
          </div>

          <button type="submit" className="btn-primary w-full">
            שליחת הודעה 💌
          </button>
        </form>

        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-display font-bold">🕐 שעות פעילות</h2>
            <p className="mt-2 text-sm text-squid-ink/70">
              ימים א׳-ה׳: 9:00-17:00
              <br />
              יום ו׳ וערבי חג: 9:00-13:00
            </p>
          </div>
          <div className="card p-5">
            <h2 className="font-display font-bold">📍 נקודת איסוף</h2>
            <p className="mt-2 text-sm text-squid-ink/70">
              רחוב הסקוויש 12, תל אביב
              <br />
              (בתיאום מראש בלבד)
            </p>
          </div>
          <div className="card p-5">
            <h2 className="font-display font-bold">💬 מענה מהיר</h2>
            <p className="mt-2 text-sm text-squid-ink/70">
              הדרך הכי מהירה אלינו היא בהודעה פרטית ב-TikTok או באינסטגרם — עונים תוך שעות
              ספורות!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
