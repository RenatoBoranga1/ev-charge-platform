import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';

import { useAdminSession } from './session-store';
import { ApiError, loginAdmin } from '../services/api';

const loginSchema = z.object({
  email: z.email('Informe um e-mail válido.'),
  password: z.string().min(8, 'A senha deve ter pelo menos 8 caracteres.'),
});
type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const session = useAdminSession((state) => state.session);
  const [serverError, setServerError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  if (session) return <Navigate replace to="/admin" />;

  const locationState = location.state as unknown;
  const destination =
    typeof locationState === 'object' &&
    locationState !== null &&
    'from' in locationState &&
    typeof locationState.from === 'string'
      ? locationState.from
      : '/admin';

  async function submit(values: LoginForm): Promise<void> {
    setServerError(null);
    try {
      await loginAdmin(values);
      await navigate(destination, { replace: true });
    } catch (error) {
      setServerError(
        error instanceof ApiError
          ? error.message
          : 'Não foi possível autenticar. Tente novamente.',
      );
    }
  }

  return (
    <main className="login-page">
      <section className="login-brand" aria-labelledby="welcome-title">
        <span className="login-sun" aria-hidden="true">☀</span>
        <p className="eyebrow">Solar Soluções</p>
        <h1 id="welcome-title">Operação inteligente da rede Solis.</h1>
        <p>Estações, recargas e pagamentos em um ambiente seguro e auditável.</p>
      </section>
      <section className="login-panel" aria-labelledby="login-title">
        <div className="login-card">
          <p className="eyebrow">Portal administrativo</p>
          <h2 id="login-title">Acessar operações</h2>
          <p>Use sua conta de operador autorizada para o tenant.</p>
          <form onSubmit={(event) => void handleSubmit(submit)(event)} noValidate>
            <label>
              E-mail
              <input
                aria-describedby={errors.email ? 'email-error' : undefined}
                autoComplete="username"
                inputMode="email"
                {...register('email')}
              />
            </label>
            {errors.email ? <span className="field-error" id="email-error">{errors.email.message}</span> : null}
            <label>
              Senha
              <input
                aria-describedby={errors.password ? 'password-error' : undefined}
                autoComplete="current-password"
                type="password"
                {...register('password')}
              />
            </label>
            {errors.password ? <span className="field-error" id="password-error">{errors.password.message}</span> : null}
            {serverError ? <div className="form-error" role="alert">{serverError}</div> : null}
            <button className="button button-primary button-full" disabled={isSubmitting} type="submit">
              {isSubmitting ? 'Autenticando…' : 'Entrar com segurança'}
            </button>
          </form>
          <small>O refresh token permanece em cookie HttpOnly e o acesso é mantido somente em memória.</small>
        </div>
      </section>
    </main>
  );
}
