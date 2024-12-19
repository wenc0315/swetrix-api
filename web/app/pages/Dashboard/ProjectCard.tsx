import React, { useState, useMemo } from 'react'
import { Link } from '@remix-run/react'
import { toast } from 'sonner'
import cx from 'clsx'
import _size from 'lodash/size'
import _isNumber from 'lodash/isNumber'
import _replace from 'lodash/replace'
import _find from 'lodash/find'
import _map from 'lodash/map'
import { useTranslation } from 'react-i18next'
import { AdjustmentsVerticalIcon } from '@heroicons/react/24/outline'
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/20/solid'

import Modal from '~/ui/Modal'
import { Badge, BadgeProps } from '~/ui/Badge'
import routes from '~/utils/routes'
import { nFormatter, calculateRelativePercentage } from '~/utils/generic'

import { acceptProjectShare } from '~/api'

import { OverallObject, Project } from '~/lib/models/Project'
import { useSelector } from 'react-redux'
import { StateType, useAppDispatch } from '~/lib/store'
import { authActions } from '~/lib/reducers/auth'
import { SquareArrowOutUpRightIcon } from 'lucide-react'
import Spin from '~/ui/icons/Spin'

interface ProjectCardProps {
  live?: string | number | null
  overallStats?: OverallObject
  project: Project
}

interface MiniCardProps {
  labelTKey: string
  total?: number | string | null
  percChange?: number
}

const MiniCard = ({ labelTKey, total = 0, percChange }: MiniCardProps) => {
  const { t } = useTranslation('common')
  const statsDidGrowUp = percChange ? percChange >= 0 : false

  return (
    <div>
      <p className='text-sm text-gray-500 dark:text-gray-300'>{t(labelTKey)}</p>

      <div className='flex font-bold'>
        {total === null ? (
          <Spin className='!ml-0 mt-2' />
        ) : (
          <>
            <p className='text-xl text-gray-700 dark:text-gray-100'>{_isNumber(total) ? nFormatter(total) : total}</p>
            {_isNumber(percChange) && (
              <p
                className={cx('flex items-center text-xs', {
                  'text-green-600': statsDidGrowUp,
                  'text-red-600': !statsDidGrowUp,
                })}
              >
                {statsDidGrowUp ? (
                  <>
                    <ChevronUpIcon className='h-4 w-4 flex-shrink-0 self-center text-green-500' />
                    <span className='sr-only'>{t('dashboard.inc')}</span>
                  </>
                ) : (
                  <>
                    <ChevronDownIcon className='h-4 w-4 flex-shrink-0 self-center text-red-500' />
                    <span className='sr-only'>{t('dashboard.dec')}</span>
                  </>
                )}
                {nFormatter(percChange)}%
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export const ProjectCard = ({ live = null, project, overallStats }: ProjectCardProps) => {
  const { t } = useTranslation('common')
  const [showInviteModal, setShowInviteModal] = useState(false)

  const { user } = useSelector((state: StateType) => state.auth)

  const dispatch = useAppDispatch()

  const shareId = useMemo(() => _find(project.share, (item) => item.user.id === user.id)?.id, [project.share, user.id])

  const { id, name, public: isPublic, active, isTransferring, share, organisation, role } = project

  const badges = useMemo(() => {
    const list: BadgeProps[] = []

    if (!active) {
      list.push({ colour: 'red', label: t('dashboard.disabled') })
    }

    if (organisation) {
      list.push({ colour: 'sky', label: organisation.name })
    }

    if (project.role !== 'owner' && shareId) {
      list.push({ colour: 'indigo', label: t('dashboard.shared') })
    }

    if (project.role !== 'owner' && !project.isAccessConfirmed) {
      list.push({ colour: 'yellow', label: t('common.pending') })
    }

    if (project.isCaptchaProject) {
      list.push({ colour: 'indigo', label: t('dashboard.captcha') })
    }

    if (isTransferring) {
      list.push({ colour: 'indigo', label: t('common.transferring') })
    }

    if (isPublic) {
      list.push({ colour: 'green', label: t('dashboard.public') })
    }

    const members = _size(share)

    if (members > 0) {
      list.push({ colour: 'slate', label: t('common.xMembers', { number: members + 1 }) })
    }

    return list
  }, [
    t,
    active,
    isTransferring,
    isPublic,
    organisation,
    share,
    project.isAccessConfirmed,
    project.role,
    project.isCaptchaProject,
    shareId,
  ])

  const onAccept = async () => {
    try {
      if (!shareId) {
        throw new Error('Project share not found')
      }

      await acceptProjectShare(shareId)

      dispatch(
        authActions.mergeUser({
          sharedProjects: user.sharedProjects?.map((item) => {
            if (item.id === shareId) {
              return { ...item, isAccessConfirmed: true }
            }

            return item
          }),
        }),
      )

      toast.success(t('apiNotifications.acceptInvitation'))
    } catch (reason: any) {
      console.error(`[ERROR] Error while accepting project invitation: ${reason}`)
      toast.error(t('apiNotifications.acceptInvitationError'))
    }
  }

  const onElementClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (project.role === 'owner' || project.isAccessConfirmed) {
      return
    }

    e.preventDefault()
    setShowInviteModal(true)
  }

  return (
    <Link
      to={_replace(project.isCaptchaProject ? routes.captcha : routes.project, ':id', id)}
      onClick={onElementClick}
      className='min-h-[153.1px] cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-gray-50 hover:bg-gray-100 dark:border-slate-800/25 dark:bg-slate-800 dark:hover:bg-slate-700'
    >
      <div className='px-4 py-4'>
        <div className='flex items-center justify-between'>
          <p className='truncate text-lg font-semibold text-slate-900 dark:text-gray-50'>{name}</p>

          <div className='flex items-center gap-2'>
            {role !== 'viewer' && (
              <Link onClick={(e) => e.stopPropagation()} to={_replace(routes.project_settings, ':id', id)}>
                <AdjustmentsVerticalIcon
                  className='h-6 w-6 text-gray-800 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-500'
                  aria-label={`${t('project.settings.settings')} ${name}`}
                />
              </Link>
            )}
            <a
              href={_replace(project.isCaptchaProject ? routes.captcha : routes.project, ':id', id)}
              onClick={(e) => e.stopPropagation()}
              aria-label='name (opens in a new tab)'
              target='_blank'
              rel='noopener noreferrer'
            >
              <SquareArrowOutUpRightIcon
                className='h-6 w-6 text-gray-800 hover:text-gray-900 dark:text-slate-400 dark:hover:text-slate-500'
                strokeWidth={1.5}
              />
            </a>
          </div>
        </div>
        <div className='mt-1 flex flex-shrink-0 flex-wrap gap-2'>
          {badges.length > 0 ? (
            badges.map((badge) => <Badge key={badge.label} {...badge} />)
          ) : (
            <Badge label='I' colour='slate' className='invisible' />
          )}
        </div>
        <div className='mt-4 flex flex-shrink-0 gap-5'>
          <MiniCard
            labelTKey={project.isCaptchaProject ? 'dashboard.captchaEvents' : 'dashboard.pageviews'}
            total={live === 'N/A' ? 'N/A' : (overallStats?.current.all ?? null)}
            percChange={
              live === 'N/A'
                ? 0
                : calculateRelativePercentage(overallStats?.previous.all ?? 0, overallStats?.current.all ?? 0)
            }
          />
          {project.isAnalyticsProject && <MiniCard labelTKey='dashboard.liveVisitors' total={live} />}
        </div>
      </div>
      {project.role !== 'owner' && !project.isAccessConfirmed && (
        <Modal
          onClose={() => {
            setShowInviteModal(false)
          }}
          onSubmit={() => {
            setShowInviteModal(false)
            onAccept()
          }}
          submitText={t('common.accept')}
          type='confirmed'
          closeText={t('common.cancel')}
          title={t('dashboard.invitationFor', { project: name })}
          message={t('dashboard.invitationDesc', { project: name })}
          isOpened={showInviteModal}
        />
      )}
    </Link>
  )
}

export const ProjectCardSkeleton = () => {
  return (
    <div className='grid grid-cols-1 gap-x-6 gap-y-3 lg:grid-cols-3 lg:gap-y-6'>
      {_map(Array(12), (_, index) => (
        <div
          key={index}
          className='min-h-[153.1px] animate-pulse cursor-wait overflow-hidden rounded-xl border border-gray-200 bg-gray-50 dark:border-slate-800/25 dark:bg-slate-800'
        >
          <div className='px-4 py-4'>
            <div className='flex items-center justify-between'>
              <div className='h-6 w-3/4 rounded bg-gray-200 dark:bg-slate-700'></div>
              <div className='flex items-center gap-2'>
                <div className='h-6 w-6 rounded-[3px] bg-gray-200 dark:bg-slate-700'></div>
                <div className='h-6 w-6 rounded-[3px] bg-gray-200 dark:bg-slate-700'></div>
              </div>
            </div>
            <div className='mt-1 flex flex-shrink-0 flex-wrap gap-2'>
              <div className='h-4 w-16 rounded bg-gray-200 dark:bg-slate-700'></div>
              <div className='h-4 w-16 rounded bg-gray-200 dark:bg-slate-700'></div>
              <div className='h-4 w-16 rounded bg-gray-200 dark:bg-slate-700'></div>
            </div>
            <div className='mt-8 flex flex-shrink-0 gap-5'>
              <div className='h-10 w-24 rounded bg-gray-200 dark:bg-slate-700'></div>
              <div className='h-10 w-24 rounded bg-gray-200 dark:bg-slate-700'></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
