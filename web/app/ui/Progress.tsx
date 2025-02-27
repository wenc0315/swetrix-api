import React, { memo } from 'react'

interface ProgressProps {
  now: number
}

const Progress = ({ now }: ProgressProps) => (
  <div className='relative'>
    <div className='flex h-2 overflow-hidden rounded bg-blue-200 text-xs dark:bg-slate-600'>
      <div
        style={{ width: `${now}%` }}
        className='flex flex-col justify-center whitespace-nowrap bg-blue-500 text-center text-white shadow-none dark:bg-blue-700'
      />
    </div>
  </div>
)

export default memo(Progress)
