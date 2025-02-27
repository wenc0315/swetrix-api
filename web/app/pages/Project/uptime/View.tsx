import React, { useCallback, useEffect, useMemo, useState } from 'react'
import bb from 'billboard.js'
import cx from 'clsx'
import _map from 'lodash/map'
import _isEmpty from 'lodash/isEmpty'
import _includes from 'lodash/includes'
import _replace from 'lodash/replace'
import _filter from 'lodash/filter'
import { Link, useNavigate } from '@remix-run/react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import {
  CurrencyDollarIcon,
  AdjustmentsVerticalIcon,
  PlusCircleIcon,
  ClockIcon,
  ChevronLeftIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import { toast } from 'sonner'

import routes from '~/utils/routes'
import Button from '~/ui/Button'
import Modal from '~/ui/Modal'
import PaidFeature from '~/modals/PaidFeature'
import { DEFAULT_MONITORS_TAKE, PLAN_LIMITS, tbPeriodPairs, UPTIME_PERIOD_PAIRS } from '~/lib/constants'
import { deleteMonitor as deleteMonitorApi, getMonitorOverallStats, getMonitorStats, getProjectMonitors } from '~/api'
import { StateType } from '~/lib/store'
import { Monitor, MonitorOverallObject } from '~/lib/models/Uptime'
import { useViewProjectContext } from '../View/ViewProject'
import { getFormatDate, getSettingsUptime } from '../View/ViewProject.helpers'
import TBPeriodSelector from '../View/components/TBPeriodSelector'
import { MetricCardsUptime } from '../View/components/MetricCards'
import NoMonitorEvents from './components/NoMonitorDetails'
import Loader from '~/ui/Loader'
import Pagination from '~/ui/Pagination'
import { RotateCw, Trash2Icon } from 'lucide-react'

interface MonitorCardProps {
  monitor: Monitor
  deleteMonitor: (id: string) => void
  onClick: (monitor: Monitor) => void
  allowedToManage: boolean
}

const MonitorCard = ({ monitor, deleteMonitor, onClick, allowedToManage }: MonitorCardProps) => {
  const { t } = useTranslation()
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  return (
    <>
      <div onClick={() => onClick(monitor)} role='button' tabIndex={0}>
        <li className='min-h-[120px] cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 dark:border-slate-800/25 dark:bg-[#162032] dark:hover:bg-slate-800'>
          <div className='px-4 py-4'>
            <div className='flex justify-between'>
              <div>
                <p className='flex items-center gap-x-2 text-lg text-slate-900 dark:text-gray-50'>
                  <span className='font-semibold'>{monitor.name}</span>
                  {/* <Separator />
                <span>{queryMetric}</span> */}
                </p>
              </div>
              {allowedToManage && (
                <div className='flex gap-2'>
                  <Link
                    to={_replace(_replace(routes.uptime_settings, ':pid', monitor.projectId), ':id', monitor.id)}
                    onClick={(e) => {
                      e.stopPropagation()
                    }}
                  >
                    <AdjustmentsVerticalIcon
                      role='button'
                      aria-label={t('common.settings')}
                      className='h-6 w-6 text-gray-800 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-500'
                    />
                  </Link>
                  <Trash2Icon
                    onClick={(e) => {
                      e.stopPropagation()
                      setShowDeleteModal(true)
                    }}
                    role='button'
                    aria-label={t('common.delete')}
                    className='h-6 w-6 text-gray-800 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-500'
                    strokeWidth={1.5}
                  />
                </div>
              )}
            </div>
          </div>
        </li>
      </div>
      <Modal
        onClose={() => setShowDeleteModal(false)}
        onSubmit={() => deleteMonitor(monitor.id)}
        submitText={t('monitor.delete')}
        closeText={t('common.close')}
        title={t('monitor.qDelete')}
        message={t('monitor.deleteHint')}
        submitType='danger'
        type='error'
        isOpened={showDeleteModal}
      />
    </>
  )
}

interface AddMonitorProps {
  handleNewMonitor: () => void
  isLimitReached: boolean
}

const AddMonitor = ({ handleNewMonitor, isLimitReached }: AddMonitorProps) => {
  const { t } = useTranslation()

  return (
    <li
      onClick={handleNewMonitor}
      className='group flex h-auto min-h-[120px] cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 hover:border-gray-400 dark:border-gray-500 dark:hover:border-gray-600'
    >
      <div>
        {isLimitReached ? (
          <CurrencyDollarIcon className='mx-auto h-12 w-12 text-gray-400 group-hover:text-gray-500 dark:text-gray-200 group-hover:dark:text-gray-400' />
        ) : (
          <PlusCircleIcon className='mx-auto h-12 w-12 text-gray-400 group-hover:text-gray-500 dark:text-gray-200 group-hover:dark:text-gray-400' />
        )}
        <span className='mt-2 block text-sm font-semibold text-gray-900 dark:text-gray-50 group-hover:dark:text-gray-400'>
          {t('monitor.create')}
        </span>
      </div>
    </li>
  )
}

const Uptime = () => {
  const {
    projectId,
    isLoading: isProjectLoading,
    dateRange,
    timeBucket,
    period,
    timezone,
    projectPassword,
    refCalendar,
    setDateRange,
    updatePeriod,
    setPeriodPairs,
    activePeriod,
    periodPairs,
    size,
    timeFormat,
    allowedToManage,
  } = useViewProjectContext()
  const {
    t,
    i18n: { language },
  } = useTranslation()
  const { user, authenticated } = useSelector((state: StateType) => state.auth)
  const [isPaidFeatureOpened, setIsPaidFeatureOpened] = useState(false)
  const [activeMonitor, setActiveMonitor] = useState<{
    monitor: Monitor
    overall?: MonitorOverallObject
    isFailed?: boolean
  } | null>(null)
  const [isMonitorLoading, setIsMonitorLoading] = useState(false)
  const navigate = useNavigate()

  const rotateXAxis = useMemo(() => size.width > 0 && size.width < 500, [size])

  const [isLoading, setIsLoading] = useState<boolean | null>(null)
  const [total, setTotal] = useState(0)
  const [monitors, setMonitors] = useState<Monitor[]>([])
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)

  const limits = PLAN_LIMITS[user?.planCode] || PLAN_LIMITS.trial
  const isLimitReached = authenticated && total >= limits?.maxMonitors

  const pageAmount = Math.ceil(total / DEFAULT_MONITORS_TAKE)

  const loadMonitors = async (take: number, skip: number, search?: string) => {
    if (isLoading) {
      return
    }
    setIsLoading(true)

    try {
      const result = await getProjectMonitors(projectId, take, skip)
      setMonitors(result.results)
      setTotal(result.total)
    } catch (reason: any) {
      setError(reason)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadMonitors(DEFAULT_MONITORS_TAKE, (page - 1) * DEFAULT_MONITORS_TAKE)

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  const handleNewMonitor = () => {
    if (isLimitReached) {
      setIsPaidFeatureOpened(true)
      return
    }

    navigate(_replace(routes.create_uptime, ':pid', projectId))
  }

  const allowedPeriodPairs = useMemo(
    () => _filter(periodPairs, (el) => _includes(UPTIME_PERIOD_PAIRS, el.period)),
    [periodPairs],
  )

  const onDelete = async (id: string) => {
    try {
      await deleteMonitorApi(projectId, id)
      toast.success(t('monitor.monitorDeleted'))
    } catch (reason: any) {
      toast.error(reason?.response?.data?.message || reason?.message || 'Something went wrong')
    }
  }

  const bbDataNames = useMemo(
    () => ({
      avgResponseTime: t('monitor.metrics.avg'),
    }),
    [t],
  )

  const loadMonitorData = useCallback(
    async (monitor: Monitor) => {
      if (isMonitorLoading || !projectId || isProjectLoading) {
        return
      }

      setIsMonitorLoading(true)

      try {
        let overallStats
        let monitorStats
        let from
        let to

        if (dateRange) {
          from = getFormatDate(dateRange[0])
          to = getFormatDate(dateRange[1])
        }

        if (period === 'custom' && dateRange) {
          // eslint-disable-next-line no-extra-semi, @typescript-eslint/no-extra-semi
          ;[overallStats, monitorStats] = await Promise.all([
            getMonitorOverallStats(projectId, [monitor.id], period, from, to, timezone, projectPassword),
            getMonitorStats(projectId, monitor.id, period, timeBucket, from, to, timezone, projectPassword),
          ])
        } else {
          // eslint-disable-next-line no-extra-semi, @typescript-eslint/no-extra-semi
          ;[overallStats, monitorStats] = await Promise.all([
            getMonitorOverallStats(projectId, [monitor.id], period, '', '', timezone, projectPassword),
            getMonitorStats(projectId, monitor.id, period, timeBucket, '', '', timezone, projectPassword),
          ])
        }

        setActiveMonitor({
          monitor,
          overall: overallStats[monitor.id],
          isFailed: false,
        })

        const { chart } = monitorStats

        setTimeout(() => {
          // todo: chart type
          const bbSettings = getSettingsUptime(chart, timeBucket, timeFormat, rotateXAxis, 'line')

          const generate = bb.generate(bbSettings)
          generate.data.names(bbDataNames)
        }, 100)

        setIsMonitorLoading(false)
      } catch (reason) {
        setActiveMonitor({
          monitor,
          isFailed: true,
        })
        setIsMonitorLoading(false)

        console.error('[ERROR](loadMonitorData) Loading monitor data failed')
        console.error(reason)
      }
    },
    [
      projectPassword,
      timezone,
      period,
      dateRange,
      isProjectLoading,
      isMonitorLoading,
      projectId,
      timeBucket,
      rotateXAxis,
      bbDataNames,
      timeFormat,
    ],
  )

  useEffect(() => {
    if (activeMonitor) {
      loadMonitorData(activeMonitor.monitor)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, dateRange, timeBucket])

  if (error && isLoading === false) {
    return (
      <div className='bg-gray-50 px-4 py-16 dark:bg-slate-900 sm:px-6 sm:py-24 md:grid md:place-items-center lg:px-8'>
        <div className='mx-auto max-w-max'>
          <main className='sm:flex'>
            <XCircleIcon className='h-12 w-12 text-red-400' aria-hidden='true' />
            <div className='sm:ml-6'>
              <div className='max-w-prose sm:border-l sm:border-gray-200 sm:pl-6'>
                <h1 className='text-4xl font-extrabold tracking-tight text-gray-900 dark:text-gray-50 sm:text-5xl'>
                  {t('apiNotifications.somethingWentWrong')}
                </h1>
                <p className='mt-4 text-2xl font-medium tracking-tight text-gray-700 dark:text-gray-200'>
                  {t('apiNotifications.errorCode', { error })}
                </p>
              </div>
              <div className='mt-8 flex space-x-3 sm:border-l sm:border-transparent sm:pl-6'>
                <button
                  type='button'
                  onClick={() => window.location.reload()}
                  className='inline-flex items-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2'
                >
                  {t('dashboard.reloadPage')}
                </button>
                <Link
                  to={routes.contact}
                  className='inline-flex items-center rounded-md border border-transparent bg-indigo-100 px-4 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:bg-slate-800 dark:text-gray-50 dark:hover:bg-slate-700 dark:focus:ring-gray-50'
                >
                  {t('notFoundPage.support')}
                </Link>
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  if (isLoading || isLoading === null) {
    return (
      <div className='mt-4'>
        <Loader />
      </div>
    )
  }

  if (activeMonitor) {
    return (
      <>
        <div className='mt-2 flex flex-col items-center justify-between lg:flex-row lg:items-start'>
          <div className='flex flex-wrap items-center space-x-5'>
            <h2 className='break-words break-all text-xl font-bold text-gray-900 dark:text-gray-50'>
              {activeMonitor.monitor.name}
            </h2>
          </div>
          <div className='mx-auto mt-3 flex w-full max-w-[420px] flex-wrap items-center justify-center gap-y-1 space-x-2 sm:mx-0 sm:w-auto sm:max-w-none sm:flex-nowrap sm:justify-between lg:mt-0'>
            <button
              type='button'
              title={t('project.refreshStats')}
              onClick={() => loadMonitorData(activeMonitor.monitor)}
              className={cx(
                'relative rounded-md bg-gray-50 p-2 text-sm font-medium hover:bg-white hover:shadow-sm focus:z-10 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:bg-slate-900 dark:hover:bg-slate-800 focus:dark:border-gray-200 focus:dark:ring-gray-200',
                {
                  'cursor-not-allowed opacity-50': isProjectLoading || isMonitorLoading,
                },
              )}
            >
              <RotateCw className='h-5 w-5 text-gray-700 dark:text-gray-50' />
            </button>
            <TBPeriodSelector
              activePeriod={activePeriod}
              items={allowedPeriodPairs}
              title={activePeriod?.label}
              onSelect={(pair) => {
                if (pair.isCustomDate) {
                  setTimeout(() => {
                    refCalendar.current.openCalendar()
                  }, 100)
                } else {
                  setPeriodPairs(tbPeriodPairs(t, undefined, undefined, language))
                  setDateRange(null)
                  updatePeriod(pair)
                }
              }}
            />
          </div>
        </div>
        <button
          type='button'
          onClick={() => setActiveMonitor(null)}
          className='mx-auto mb-4 mt-2 flex items-center text-base font-normal text-gray-900 underline decoration-dashed hover:decoration-solid dark:text-gray-100 lg:mx-0 lg:mt-0'
        >
          <ChevronLeftIcon className='h-4 w-4' />
          {t('monitor.backToMonitors')}
        </button>
        {activeMonitor.isFailed ? (
          <>
            <NoMonitorEvents />
            {isMonitorLoading && (
              <div className='static mt-4 !bg-transparent' id='loader'>
                <div className='loader-head dark:!bg-slate-800'>
                  <div className='first dark:!bg-slate-600' />
                  <div className='second dark:!bg-slate-600' />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className='pt-2'>
            <div className='mb-5 flex flex-wrap justify-center gap-5 lg:justify-start'>
              <MetricCardsUptime overall={activeMonitor.overall!} />
            </div>
            <div className='mt-5 h-80 md:mt-0 [&_svg]:!overflow-visible' id='avgResponseUptimeChart' />
            {isMonitorLoading && (
              <div className='static mt-4 !bg-transparent' id='loader'>
                <div className='loader-head dark:!bg-slate-800'>
                  <div className='first dark:!bg-slate-600' />
                  <div className='second dark:!bg-slate-600' />
                </div>
              </div>
            )}
          </div>
        )}
      </>
    )
  }

  return (
    <div>
      <div className='mt-4'>
        {_isEmpty(monitors) ? (
          <div className='mt-5 rounded-xl bg-gray-700 p-5'>
            <div className='flex items-center text-gray-50'>
              <ClockIcon className='mr-2 h-8 w-8' />
              <p className='text-3xl font-bold'>{t('dashboard.uptime')}</p>
            </div>
            <p className='mt-2 whitespace-pre-wrap text-lg text-gray-100'>{t('dashboard.uptimeDesc')}</p>
            {authenticated ? (
              <Button
                onClick={handleNewMonitor}
                className='mt-6 rounded-md border border-transparent bg-white px-3 py-2 text-base font-medium text-gray-700 hover:bg-indigo-50 md:px-4'
                secondary
                large
              >
                <>
                  {isLimitReached && <CurrencyDollarIcon className='mr-1 h-5 w-5' />}
                  {t('monitor.create')}
                </>
              </Button>
            ) : (
              <Link
                to={routes.signup}
                className='mt-6 inline-block select-none rounded-md border border-transparent bg-white px-3 py-2 text-base font-medium text-gray-700 hover:bg-indigo-50'
                aria-label={t('titles.signup')}
              >
                {t('common.getStarted')}
              </Link>
            )}
          </div>
        ) : (
          <ul className='mt-4 grid grid-cols-1 gap-x-6 gap-y-3 lg:grid-cols-3 lg:gap-y-6'>
            {_map(monitors, (monitor) => (
              <MonitorCard
                allowedToManage={allowedToManage}
                key={monitor.id}
                monitor={monitor}
                deleteMonitor={onDelete}
                onClick={loadMonitorData}
              />
            ))}
            <AddMonitor handleNewMonitor={handleNewMonitor} isLimitReached={isLimitReached} />
          </ul>
        )}
        {pageAmount > 1 ? (
          <Pagination
            className='mt-4'
            page={page}
            pageAmount={pageAmount}
            setPage={setPage}
            total={total}
            pageSize={DEFAULT_MONITORS_TAKE}
          />
        ) : null}
      </div>
      <PaidFeature isOpened={isPaidFeatureOpened} onClose={() => setIsPaidFeatureOpened(false)} />
    </div>
  )
}

export default Uptime
