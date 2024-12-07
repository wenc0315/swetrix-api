import React from 'react'
import { useSelector } from 'react-redux'
import { useNavigate, useParams } from '@remix-run/react'
import _find from 'lodash/find'
import _replace from 'lodash/replace'
import { StateType } from 'redux/store'
import routes from 'utils/routes'

type PropsType = {
  [key: string]: any
}

export const withProjectProtected = <P extends PropsType>(WrappedComponent: any) => {
  const WithProjectProtected = (props: P) => {
    const passwords = useSelector((state: StateType) => state.ui.projects.password)
    const projects = useSelector((state: StateType) => state.ui.projects.projects)
    const navigate = useNavigate()
    const { id }: any = useParams()
    const { queryPassword } = props
    const project = _find(projects, { id })

    // If project role is present (i.e. viewer, admin, owner), we don't need to check for password
    // as the user has access to the project
    if (project?.role) {
      return <WrappedComponent {...props} />
    }

    if (project?.isPasswordProtected && !passwords[id] && !queryPassword) {
      navigate(_replace(routes.project_protected_password, ':id', id))
      return null
    }

    return <WrappedComponent {...props} />
  }

  return WithProjectProtected
}
