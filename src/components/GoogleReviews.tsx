import React, { useState, useEffect } from 'react';
import { Star, ChevronLeft, ChevronRight, Quote, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ReviewsData } from '../types';

interface GoogleReviewsProps {
  reviewsData?: ReviewsData;
  onReviewAdded?: () => void;
}

const FALLBACK_GOOGLE_URL = 'https://www.google.com/search?q=phoenix+eletrica';

const GoogleLogo: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

const Stars: React.FC<{ value: number; className?: string }> = ({ value, className = 'w-4 h-4' }) => (
  <div className="flex items-center gap-0.5" aria-label={`${value} de 5 estrelas`}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Star
        key={n}
        className={`${className} ${n <= Math.round(value) ? 'fill-[#FBBC04] text-[#FBBC04]' : 'fill-slate-200 text-slate-200'}`}
      />
    ))}
  </div>
);

export const GoogleReviews: React.FC<GoogleReviewsProps> = ({ reviewsData }) => {
  // Somente avaliações reais vindas da API (Google Places ou cadastradas pelo lojista)
  const reviews = reviewsData?.reviews ?? [];
  const total = reviewsData?.total || 0;
  const rating = reviewsData?.ratingAverage || 0;
  const googleUrl = reviewsData?.googleUrl || FALLBACK_GOOGLE_URL;

  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused || reviews.length < 2) return;
    const timer = setTimeout(() => {
      setDirection(1);
      setCurrentIndex((prev) => (prev + 1) % reviews.length);
    }, 6000);
    return () => clearTimeout(timer);
  }, [currentIndex, isPaused, reviews.length]);

  useEffect(() => {
    if (currentIndex >= reviews.length) setCurrentIndex(0);
  }, [reviews.length, currentIndex]);

  const go = (dir: 1 | -1) => {
    setDirection(dir);
    setCurrentIndex((prev) => (prev + dir + reviews.length) % reviews.length);
  };

  const review = reviews[currentIndex];

  return (
    <section id="avaliacoes" className="py-20 sm:py-24 bg-white overflow-hidden scroll-mt-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-40px' }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-xl mx-auto mb-12"
        >
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand-red">Avaliações</span>
          <h2 className="mt-2 text-3xl sm:text-4xl font-extrabold text-brand-navy tracking-tight">
            Quem compra, recomenda
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          {/* Resumo da nota */}
          <motion.div
            initial={{ opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className={`${review ? 'lg:col-span-4' : 'lg:col-span-6 lg:col-start-4'} rounded-3xl bg-surface ring-1 ring-slate-200/70 p-8 flex flex-col items-center justify-center text-center`}
          >
            <GoogleLogo className="w-10 h-10" />
            {rating > 0 ? (
              <>
                <div className="mt-4 text-6xl font-extrabold text-brand-navy tracking-tight">
                  {rating.toFixed(1).replace('.', ',')}
                </div>
                <Stars value={rating} className="w-5 h-5" />
                <div className="mt-2 text-sm text-slate-500">{total} avaliações no Google</div>
              </>
            ) : (
              <div className="mt-4 text-sm text-slate-500">Veja o que nossos clientes dizem no Google</div>
            )}
            <a
              href={googleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-6 inline-flex items-center gap-2 h-11 px-5 rounded-full bg-white ring-1 ring-slate-200 text-sm font-bold text-slate-700 hover:ring-brand-blue hover:text-brand-blue transition-all"
            >
              Ver todas no Google
              <ExternalLink className="w-4 h-4" />
            </a>
          </motion.div>

          {/* Carrossel de depoimentos reais */}
          {review && (
            <div
              className="lg:col-span-8 relative rounded-3xl bg-brand-navy text-white p-8 sm:p-10 overflow-hidden min-h-[300px] flex flex-col"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              <div className="absolute inset-0 bg-grid opacity-40" />
              <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-brand-blue/50 blur-3xl animate-glow" />
              <Quote className="absolute right-8 top-8 w-16 h-16 text-white/10" />

              <div className="relative flex-1">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.figure
                    key={review.id}
                    custom={direction}
                    initial={{ opacity: 0, x: direction * 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: direction * -40 }}
                    transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="flex flex-col h-full"
                  >
                    <Stars value={review.nota} />
                    <blockquote className="mt-5 text-lg sm:text-xl leading-relaxed text-blue-50 line-clamp-6">
                      “{review.comentario}”
                    </blockquote>
                    <figcaption className="mt-8 flex items-center gap-3">
                      {review.foto ? (
                        <img
                          src={review.foto}
                          alt=""
                          referrerPolicy="no-referrer"
                          className="w-11 h-11 rounded-full object-cover ring-2 ring-white/20"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-full bg-brand-yellow text-brand-navy font-bold flex items-center justify-center">
                          {review.autor.charAt(0)}
                        </div>
                      )}
                      <div>
                        {review.link ? (
                          <a href={review.link} target="_blank" rel="noopener noreferrer" className="font-bold hover:underline">
                            {review.autor}
                          </a>
                        ) : (
                          <div className="font-bold">{review.autor}</div>
                        )}
                        <div className="text-xs text-blue-100/60">
                          {[review.data_texto, 'Google'].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                    </figcaption>
                  </motion.figure>
                </AnimatePresence>
              </div>

              {reviews.length > 1 && (
                <div className="relative mt-8 flex items-center justify-between">
                  <div className="flex gap-1.5">
                    {reviews.map((r, i) => (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => {
                          setDirection(i > currentIndex ? 1 : -1);
                          setCurrentIndex(i);
                        }}
                        aria-label={`Ver avaliação ${i + 1}`}
                        className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer ${
                          i === currentIndex ? 'w-6 bg-brand-yellow' : 'w-1.5 bg-white/30 hover:bg-white/60'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => go(-1)}
                      aria-label="Avaliação anterior"
                      className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 ring-1 ring-white/15 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => go(1)}
                      aria-label="Próxima avaliação"
                      className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 ring-1 ring-white/15 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
