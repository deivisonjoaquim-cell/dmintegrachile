import React, { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
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
    <div className="bg-white dark:bg-[#0D1422] border border-[#E5E7EB] dark:border-[#1E293B] rounded-xl overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-12 items-stretch">
        <div className="lg:col-span-7 p-7 sm:p-10 space-y-6 flex flex-col justify-center">
          <div className="space-y-2">
            <p className="text-xs font-semibold tracking-[0.06em] text-[#0F3D91] dark:text-[#60A5FA]">
              {t.comparator.kicker}
            </p>
            <h3 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#0B1628] dark:text-white">
              {t.comparator.title}
            </h3>
            <p className="text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed max-w-xl">
              {t.comparator.subtitle}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div>
              <label htmlFor="comp-local" className="block font-semibold text-[#0B1628] dark:text-slate-200 mb-2">
                {t.comparator.labelWhere}
              </label>
              <select
                id="comp-local"
                value={compLocal}
                onChange={(e) => setCompLocal(e.target.value as typeof compLocal)}
                className="w-full px-3 py-2.5 rounded-lg border border-[#D1D5DB] dark:border-[#334155] bg-[#F7F8FA] dark:bg-[#151F32] text-[#0B1628] dark:text-slate-100 focus:bg-white dark:focus:bg-[#1A263C] focus:border-[#0F3D91] dark:focus:border-[#60A5FA] focus:outline-none transition-colors"
              >
                <option value="brasil">{t.comparator.whereOptions.brasil}</option>
                <option value="turista_chile">{t.comparator.whereOptions.turista_chile}</option>
                <option value="residente_chile">{t.comparator.whereOptions.residente_chile}</option>
              </select>
            </div>

            <div>
              <label htmlFor="comp-objetivo" className="block font-semibold text-[#0B1628] dark:text-slate-200 mb-2">
                {t.comparator.labelGoal}
              </label>
              <select
                id="comp-objetivo"
                value={compObj}
                onChange={(e) => setCompObj(e.target.value as typeof compObj)}
                className="w-full px-3 py-2.5 rounded-lg border border-[#D1D5DB] dark:border-[#334155] bg-[#F7F8FA] dark:bg-[#151F32] text-[#0B1628] dark:text-slate-100 focus:bg-white dark:focus:bg-[#1A263C] focus:border-[#0F3D91] dark:focus:border-[#60A5FA] focus:outline-none transition-colors"
              >
                <option value="morar_trabalhar">{t.comparator.goalOptions.morar_trabalhar}</option>
                <option value="trabalho_oferta">{t.comparator.goalOptions.trabalho_oferta}</option>
                <option value="estudar">{t.comparator.goalOptions.estudar}</option>
                <option value="renda">{t.comparator.goalOptions.renda}</option>
                <option value="familia">{t.comparator.goalOptions.familia}</option>
              </select>
            </div>

            <div>
              <label htmlFor="comp-vinculo" className="block font-semibold text-[#0B1628] dark:text-slate-200 mb-2">
                {t.comparator.labelTie}
              </label>
              <select
                id="comp-vinculo"
                value={compVinculo}
                onChange={(e) => setCompVinculo(e.target.value as typeof compVinculo)}
                className="w-full px-3 py-2.5 rounded-lg border border-[#D1D5DB] dark:border-[#334155] bg-[#F7F8FA] dark:bg-[#151F32] text-[#0B1628] dark:text-slate-100 focus:bg-white dark:focus:bg-[#1A263C] focus:border-[#0F3D91] dark:focus:border-[#60A5FA] focus:outline-none transition-colors"
              >
                <option value="nao">{t.comparator.tieOptions.nao}</option>
                <option value="sim">{t.comparator.tieOptions.sim}</option>
              </select>
            </div>
          </div>
        </div>

        <div className="lg:col-span-5 p-7 sm:p-10 bg-[#F7F8FA] dark:bg-[#111A2B] border-t lg:border-t-0 lg:border-l border-[#E5E7EB] dark:border-[#1E293B] flex flex-col justify-between gap-6">
          <div className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs font-semibold text-[#0F3D91] dark:text-[#60A5FA]">
                {t.comparator.resultKicker}
              </p>
              <p className="font-display text-lg font-bold tracking-tight text-[#0B1628] dark:text-white leading-snug">
                {recommendation.titulo}
              </p>
              <p className="text-xs font-mono text-[#6B7280] dark:text-slate-400">
                {recommendation.baseLegal}
              </p>
            </div>

            <p className="text-xs sm:text-sm text-[#4B5563] dark:text-slate-300 leading-relaxed">
              {recommendation.resumo}
            </p>

            <dl className="space-y-2 pt-3 border-t border-[#E5E7EB] dark:border-[#1E293B] text-xs">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[#6B7280] dark:text-slate-400">{t.comparator.dtProtocol}</dt>
                <dd className="text-right font-medium text-[#0B1628] dark:text-white">{recommendation.protocoloRegra}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[#6B7280] dark:text-slate-400">{t.comparator.dtWork}</dt>
                <dd className="text-right font-medium text-[#047857] dark:text-emerald-400">{recommendation.trabalho}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-[#6B7280] dark:text-slate-400">{t.comparator.dtReference}</dt>
                <dd className="text-right font-mono tabular-nums text-[#0B1628] dark:text-slate-200">{recommendation.prazoEstimado}</dd>
              </div>
            </dl>

            {recommendation.alerta && (
              <p className="text-xs font-medium text-[#92400E] dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-lg p-3 leading-relaxed">
                {recommendation.alerta}
              </p>
            )}
          </div>

          <button
            type="button"
            onMouseEnter={() => prefetchRouteChunk('/diagnostico')}
            onClick={() => onNavigateAction('/diagnostico')}
            className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg text-xs font-semibold text-white dark:text-[#0B1628] bg-[#0B1628] dark:bg-white hover:bg-[#16233B] dark:hover:bg-slate-200 transition-colors"
          >
            {t.comparator.ctaValidate}
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};
