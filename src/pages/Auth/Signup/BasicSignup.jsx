import React, { memo, useState, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { authActions } from 'redux/actions/auth'
import { useTranslation, Trans } from 'react-i18next'

import Input from 'ui/Input'
import Button from 'ui/Button'
import Checkbox from 'ui/Checkbox'
import Tooltip from 'ui/Tooltip'
import {
  isValidEmail, isValidPassword, MIN_PASSWORD_CHARS,
} from 'utils/validator'
import { HAVE_I_BEEN_PWNED_URL } from 'redux/constants'

const BasicSignup = () => {
  const { t } = useTranslation('common')
  const dispatch = useDispatch()
  const [form, setForm] = useState({
    email: '',
    password: '',
    repeat: '',
    tos: true,
    keep_signedin: true,
    checkIfLeaked: true,
  })
  const [validated, setValidated] = useState(false)
  const [errors, setErrors] = useState({})
  const [beenSubmitted, setBeenSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const onSubmit = (data) => {
    if (!isLoading) {
      setIsLoading(true)
      dispatch(authActions.signupAsync(data, t, () => {
        setIsLoading(false)
      }))
    }
  }

  useEffect(() => {
    validate()
  }, [form]) // eslint-disable-line

  const handleInput = (event) => {
    const t = event.target
    const value = t.type === 'checkbox' ? t.checked : t.value

    setForm(form => ({
      ...form,
      [t.name]: value,
    }))
  }

  const handleSubmit = e => {
    e.preventDefault()
    e.stopPropagation()
    setBeenSubmitted(true)

    if (validated) {
      onSubmit(form)
    }
  }

  const validate = () => {
    const allErrors = {}

    if (!isValidEmail(form.email)) {
      allErrors.email = t('auth.common.badEmailError')
    }

    if (!isValidPassword(form.password)) {
      allErrors.password = t('auth.common.xCharsError', { amount: MIN_PASSWORD_CHARS })
    }

    if (form.password !== form.repeat || form.repeat === '') {
      allErrors.repeat = t('auth.common.noMatchError')
    }

    const valid = Object.keys(allErrors).length === 0

    setErrors(allErrors)
    setValidated(valid)
  }

  return (
    <form className='space-y-6' onSubmit={handleSubmit}>
      <Input
        name='email'
        id='email'
        type='email'
        value={form.email}
        placeholder={t('auth.signup.email')}
        onChange={handleInput}
        error={beenSubmitted && errors.email}
      />
      <Input
        name='password'
        id='password'
        type='password'
        value={form.password}
        placeholder={t('auth.common.password')}
        className='mt-4'
        onChange={handleInput}
        error={beenSubmitted && errors.password}
      />
      <Input
        name='repeat'
        id='repeat'
        type='password'
        value={form.repeat}
        placeholder={t('auth.common.repeat')}
        className='mt-4'
        onChange={handleInput}
        error={beenSubmitted && errors.repeat}
      />
      <div className='flex mt-4'>
        <Checkbox
          checked={form.checkIfLeaked}
          onChange={handleInput}
          name='checkIfLeaked'
          id='checkIfLeaked'
          label={t('auth.common.checkLeakedPassword')}
        />
        <Tooltip
          className='ml-2'
          text={(
            <Trans
              t={t}
              i18nKey='auth.common.checkLeakedPasswordDesc'
              components={{
                // eslint-disable-next-line jsx-a11y/anchor-has-content
                db: <a href={HAVE_I_BEEN_PWNED_URL} className='font-medium text-indigo-400 hover:underline hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-500' />,
              }}
              values={{
                database: 'haveibeenpwned.com',
              }}
            />
          )}
        />
      </div>
      <Button className='w-full flex justify-center' type='submit' loading={isLoading} primary giant>
        {t('auth.signup.create')}
      </Button>
    </form>
  )
}

export default memo(BasicSignup)
