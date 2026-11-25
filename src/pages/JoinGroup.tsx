import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ErrorText, Spinner } from '../components/ui'
import { joinGroup } from '../lib/api'

/** /g/:code – inbjudningslänk till en grupp. */
export default function JoinGroup() {
  const { code = '' } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    joinGroup(code)
      .then((id) => navigate(`/grupper/${id}`, { replace: true }))
      .catch((e: Error) => setError(e.message))
  }, [code, navigate])

  return error ? <ErrorText>{error}</ErrorText> : <Spinner label="Går med i gruppen…" />
}
