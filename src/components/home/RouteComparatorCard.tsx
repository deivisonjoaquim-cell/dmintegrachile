import React, { useMemo, useState } from 'react';
import { ArrowRight, Compass } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { prefetchRouteChunk } from '../../utils/routePrefetch';

interface RouteComparatorCardProps {
  onNavigateAction: (dest: string) => void;
}

export const RouteComparatorCard: React.FC<RouteComparatorCardProps> = ({ onNavigateAction }) => {
  const { t } = useLanguage();
  const [compLocal, setCompLocal] = useState<'brasil' | 'turista_chile' | 'residente_chile'>('brasil');
  const [compObj, setCompObj] = useState<'morar_trabalhar' | 'trabalho_oferta' | 'estudar' | 'renda' | 'familia'>('morar_trabalhar');
  const [compVinculo, setCompVinculo] = useState<'nao' | 'sim'>('nao');

  const recommendation = useMemo(() => {
    const routes = t.comparator.routes;
    if (compLocal === 'residente_chile') {
      return routes.residente;
    }
    if (compVinculo === 'sim' || compObj === 'familia') {
      return {
        titulo: routes.familia.titulo,
        baseLegal: routes.familia.baseLegal,
        protocoloRegra:
          compLocal === 'turista_chile' ? routes.familia.protocoloTurista : routes.familia.protocoloExterior,
        trabalho: routes.familia.trabalho,
        prazoEstimado: routes.familia.prazoEstimado,
        resumo: routes.familia.resumo,
        alerta: compLocal === 'turista_chile' ? routes.familia.alertaTurista : undefined,
      };
    }
    if (compObj === 'trabalho_oferta') {
      return {
        ...routes.trabalho,
        alerta: compLocal === 'turista_chile' ? routes.trabalho.alertaTurista : undefined,
      };
    }
    if (compObj === 'estudar') {
      return {
        ...routes.estudar,
        alerta: compLocal === 'turista_chile' ? routes.estudar.alertaTurista : undefined,
      };
    }
    if (compObj === 'renda') {
      return {
        ...routes.renda,
        alerta: compLocal === 'turista_chile' ? routes.renda.alertaTurista : undefined,
      };
    }
    return {
      ...routes.mercosul,
      alerta: compLocal === 'turista_chile' ? routes.mercosul.alertaTurista : undefined,
    };
  }, [compLocal, compObj, compVinculo, t]);

  return (
    <div className="bg-white dark:bg-[#0D1524] border border-[#E2E8F0] dark:border-[#1E293B] card-radius overflow-hidden text-[#090F1A] dark:text-white">
      <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-7 p-6 sm:p-8 space-y-5 flex flex-col justify-center">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-[#047857] dark:text-[#34D399]" aria-hidden="true" />
              <p className="text-xs font-semibold text-[#047857] dark:text-[#34D399]">
                {t.comparator.kicker}
              </p>
            </div>
            <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#090F1A] dark:text-white">
              {t.comparator.title}
            </h3>
            <p className="text-xs sm:text-sm text-[#475569] dark:text-slate-300 leading-relaxed">
              {t.comparator.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
            <div>
              <label htmlFor="comp-local" className="block font-semibold text-[#090F1A] dark:text-slate-200 mb-1.5">
                {t.comparator.labelWhere}
              </label>
              <select
                id="comp-local"
                value={compLocal}
                onChange={(e) => setCompLocal(e.target.value as typeof compLocal)}
                className="w-full px-3 py-2.5 btn-radius border border-[#CBD5E1] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#131F33] text-[#090F1A] dark:text-slate-100 focus:bg-white dark:focus:bg-[#182842] focus:border-[#047857] dark:focus:border-[#34D399] focus:outline-none transition-colors"
              >
                <option value="brasil">{t.comparator.whereOptions.brasil}</option>
                <option value="turista_chile">{t.comparator.whereOptions.turista_chile}</option>
                <option value="residente_chile">{t.comparator.whereOptions.residente_chile}</option>
              </select>
            </div>

            <div>
              <label htmlFor="comp-objetivo" className="block font-semibold text-[#090F1A] dark:text-slate-200 mb-1.5">
                {t.comparator.labelGoal}
              </label>
              <select
                id="comp-objetivo"
                value={compObj}
                onChange={(e) => setCompObj(e.target.value as typeof compObj)}
                className="w-full px-3 py-2.5 btn-radius border border-[#CBD5E1] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#131F33] text-[#090F1A] dark:text-slate-100 focus:bg-white dark:focus:bg-[#182842] focus:border-[#047857] dark:focus:border-[#34D399] focus:outline-none transition-colors"
              >
                <option value="morar_trabalhar">{t.comparator.goalOptions.morar_trabalhar}</option>
                <option value="trabalho_oferta">{t.comparator.goalOptions.trabalho_oferta}</option>
                <option value="estudar">{t.comparator.goalOptions.estudar}</option>
                <option value="renda">{t.comparator.goalOptions.renda}</option>
                <option value="familia">{t.comparator.goalOptions.familia}</option>
              </select>
            </div>

            <div>
              <label htmlFor="comp-vinculo" className="block font-semibold text-[#090F1A] dark:text-slate-200 mb-1.5">
                {t.comparator.labelTie}
              </label>
              <select
                id="comp-vinculo"
                value={compVinculo}
                onChange={(e) => setCompVinculo(e.target.value as typeof compVinculo)}
                className="w-full px-3 py-2.5 btn-radius border border-[#CBD5E1] dark:border-[#1E293B] bg-[#F8FAFC] dark:bg-[#131F33] text-[#090F1A] dark:text-slate-100 focus:bg-white dark:focus:bg-[#182842] focus:border-[#047857] dark:focus:border-[#34D399] focus:outline-none transition-colors"
              >
                <option value="nao">{t.comparator.tieOptions.nao}</option>
                <option value="sim">{t.comparator.tieOptions.sim}</option>
              </select>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 p-6 sm:p-8 text-white flex flex-col justify-between space-y-5 border-t lg:border-t-0 lg:border-l border-white/10 bg-[#090F1A]">
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#34D399]">
                {t.comparator.resultKicker}
              </p>
              <p className="font-display text-lg sm:text-xl font-bold tracking-tight text-white leading-snug">
                {recommendation.titulo}
              </p>
              <p className="text-[11px] font-mono text-slate-400">
                {recommendation.baseLegal}
              </p>
            </div>
            <p className="text-xs sm:text-[13px] text-slate-300 leading-relaxed">
              {recommendation.resumo}
            </p>
            <dl className="grid grid-cols-1 gap-2 pt-3 border-t border-white/12 text-[11px]">
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-slate-400">{t.comparator.dtProtocol}</dt>
                <dd className="text-right font-semibold text-white">{recommendation.protocoloRegra}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-slate-400">{t.comparator.dtWork}</dt>
                <dd className="text-right font-semibold text-[#34D399]">{recommendation.trabalho}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-slate-400">{t.comparator.dtReference}</dt>
                <dd className="text-right font-mono tabular-nums text-[#D4A853]">{recommendation.prazoEstimado}</dd>
              </div>
            </dl>
            {recommendation.alerta && (
              <p className="text-[11px] font-medium text-amber-100 bg-amber-500/15 border border-amber-400/35 rounded-lg p-2.5 leading-relaxed">
                {recommendation.alerta}
              </p>
            )}
          </div>
          <button
            type="button"
            onMouseEnter={() => prefetchRouteChunk('/diagnostico')}
            onClick={() => onNavigateAction('/diagnostico')}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 btn-radius text-xs font-bold text-[#041C16] bg-[#10B981] hover:bg-[#34D399] transition-colors"
          >
            {t.comparator.ctaValidate}
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};
