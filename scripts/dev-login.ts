/**
 * DEV-ONLY verification helper (NÃO é deploy / NÃO roda em produção).
 *
 * Enquanto a página de login `/entrar` (Plan 01-10) e o envio real de email
 * (Resend, user_setup do Plan 04) não existem, este utilitário permite:
 *
 *   tsx scripts/dev-login.ts                       -> lista os usuários (prova que o cadastro gravou)
 *   tsx scripts/dev-login.ts <email>               -> marca o email como verificado e FORJA uma sessão
 *   tsx scripts/dev-login.ts --senha <email> <senha> -> define uma senha conhecida (pra logar de verdade em /entrar)
 *
 * No modo <email> ele imprime um cookie de sessão assinado (mesmo esquema do
 * seed-admin / fixtures de teste) e a linha pra colar no console do navegador,
 * pra você abrir /minha-conta/meus-dados logado e verificar o fluxo LGPD.
 *
 * O modo --senha usa o mesmo truque do seed-admin (forjar uma sessão admin
 * de 5min pra chamar `auth.api.setUserPassword`, que vive atrás do
 * adminMiddleware) — só que mirando o userId de QUALQUER conta, não só a
 * do próprio admin. Exige que já exista um admin no banco (roda seed:admin
 * antes se precisar).
 *
 * Guard de segurança: recusa rodar se NODE_ENV === 'production'.
 *
 * NOTA: o `import` do prisma é DINÂMICO (dentro de main), porque em ESM os
 * `import` estáticos são içados e rodam ANTES do código de topo — o adapter
 * Prisma leria DATABASE_URL antes do loadEnvFile e a conexão falharia.
 */
import crypto, { randomUUID } from 'node:crypto'

/** Nome do cookie de sessão Better Auth em dev (sem prefixo __Secure-). */
const SESSION_COOKIE_NAME = 'better-auth.session_token'

type Prisma = typeof import('@/lib/db/client')['prisma']

async function listUsers(prisma: Prisma) {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    select: { email: true, role: true, emailVerified: true, deletedAt: true, createdAt: true },
  })
  console.log(`\nTOTAL DE USUÁRIOS: ${users.length}\n`)
  for (const u of users) {
    console.log(
      [
        u.createdAt.toISOString(),
        u.role.padEnd(8),
        u.emailVerified ? 'VERIFICADO  ' : 'NÃO-VERIF.  ',
        u.deletedAt ? 'EXCLUÍDO' : 'ativo   ',
        u.email,
      ].join('  |  '),
    )
  }
  if (users.length === 0) {
    console.log('(nenhum usuário — o cadastro não chegou a gravar)')
  }
  console.log('\nPara logar como um deles:  npm run dev:login -- <email>\n')
}

async function forgeSession(prisma: Prisma, email: string) {
  const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
  if (!user) {
    console.error(`\nUsuário não encontrado: ${email}`)
    console.error('Rode sem argumento pra ver a lista de emails cadastrados.\n')
    process.exit(1)
  }
  if (user.deletedAt) {
    console.error(`\nEsse usuário está anonimizado/excluído (${email}). Cadastre-se de novo.\n`)
    process.exit(1)
  }

  // Marca o email como verificado (o envio real via Resend ainda não está
  // configurado — user_setup do Plan 04), senão requireEmailVerification bloqueia.
  if (!user.emailVerified) {
    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    })
    console.log(`\nEmail marcado como verificado: ${email}`)
  }

  const token = `dev-login-${randomUUID()}`
  await prisma.session.create({
    data: {
      userId: user.id,
      token,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), // 7 dias
    },
  })
  const signature = crypto
    .createHmac('sha256', process.env.BETTER_AUTH_SECRET as string)
    .update(token)
    .digest('base64')
  const value = encodeURIComponent(`${token}.${signature}`)

  console.log('\n================ LOGIN DEV ================')
  console.log(`Logado como: ${user.email} (role=${user.role})`)
  console.log('\n1) Abra http://localhost:3000 no navegador')
  console.log('2) Abra o Console (F12 -> aba Console) e cole ESTA linha:\n')
  console.log(`document.cookie = "${SESSION_COOKIE_NAME}=${value}; path=/"`)
  console.log('\n3) Vá para: http://localhost:3000/minha-conta/meus-dados')
  console.log('==========================================\n')
}

async function setPassword(prisma: Prisma, email: string, senha: string) {
  const { auth } = await import('@/lib/auth/server')

  const alvo = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } })
  if (!alvo) {
    console.error(`\nUsuário não encontrado: ${email}\n`)
    process.exit(1)
  }
  const admin = await prisma.user.findFirst({ where: { role: 'admin', deletedAt: null } })
  if (!admin) {
    console.error('\nNenhum admin encontrado — rode `npm run seed:admin` primeiro.\n')
    process.exit(1)
  }

  if (!alvo.emailVerified) {
    await prisma.user.update({
      where: { id: alvo.id },
      data: { emailVerified: true, emailVerifiedAt: new Date() },
    })
  }

  // Mesmo truque do seed-admin: sessão admin forjada de 5min, single-use,
  // só pra autorizar a chamada ao endpoint do admin-plugin.
  const ctx = await auth.$context
  const cookieName = ctx.authCookies.sessionToken.name
  const token = `dev-set-password-${randomUUID()}`
  await prisma.session.create({
    data: { userId: admin.id, token, expiresAt: new Date(Date.now() + 5 * 60 * 1000) },
  })
  const signature = crypto
    .createHmac('sha256', process.env.BETTER_AUTH_SECRET as string)
    .update(token)
    .digest('base64')
  const headers = new Headers({ cookie: `${cookieName}=${encodeURIComponent(`${token}.${signature}`)}` })

  await auth.api.setUserPassword({ headers, body: { userId: alvo.id, newPassword: senha } })
  await prisma.session.delete({ where: { token } }).catch(() => {})

  console.log('\n================ SENHA DEFINIDA ================')
  console.log(`Email: ${alvo.email}`)
  console.log(`Senha: ${senha}`)
  console.log(`Papel: ${alvo.role}`)
  console.log('\nEntra em http://localhost:3000/entrar com esses dados.')
  console.log('==================================================\n')
}

async function main() {
  // Carrega .env ANTES de importar o prisma (Node 24 built-in).
  try {
    process.loadEnvFile()
  } catch {
    // sem .env -> assume que as vars já estão no ambiente
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('dev-login é DEV-ONLY — recusa rodar em produção.')
  }

  // Import dinâmico: só agora, com DATABASE_URL já em process.env.
  const { prisma } = await import('@/lib/db/client')

  try {
    if (process.argv[2] === '--senha') {
      const [, , , email, senha] = process.argv
      if (!email || !senha) {
        console.error('\nUso: tsx scripts/dev-login.ts --senha <email> <senha>\n')
        process.exit(1)
      }
      await setPassword(prisma, email, senha)
      return
    }

    const email = process.argv[2]
    if (email) {
      await forgeSession(prisma, email)
    } else {
      await listUsers(prisma)
    }
  } finally {
    void prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
