import { Button, Flex, Loader, Stack, Text, TextInput, Title } from '@mantine/core'
import { useState, type FormEvent } from 'react'
import { signIn, signUp } from '@/chatbridge/auth'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const result = isSignUp
      ? await signUp(email, password)
      : await signIn(email, password)

    setLoading(false)

    if (result.error) {
      setError(result.error.message)
    }
  }

  return (
    <Flex
      align="center"
      justify="center"
      className="h-full w-full"
      data-testid="login-page"
    >
      <Stack
        gap="md"
        className="w-full max-w-sm p-8"
        component="form"
        onSubmit={handleSubmit}
      >
        <Title order={2} ta="center">
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </Title>
        <Text c="chatbox-secondary" ta="center" size="sm">
          {isSignUp
            ? 'Sign up to get started with ChatBridge'
            : 'Sign in to your ChatBridge account'}
        </Text>

        {error && (
          <Text c="chatbox-error" size="sm" ta="center" data-testid="auth-error">
            {error}
          </Text>
        )}

        <TextInput
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          required
        />

        <TextInput
          label="Password"
          type="password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          required
        />

        <Button type="submit" fullWidth disabled={loading}>
          {loading ? <Loader size="xs" /> : isSignUp ? 'Sign Up' : 'Sign In'}
        </Button>

        <Text
          c="chatbox-secondary"
          size="sm"
          ta="center"
          className="cursor-pointer"
          onClick={() => {
            setIsSignUp(!isSignUp)
            setError(null)
          }}
        >
          {isSignUp
            ? 'Already have an account? Sign In'
            : "Don't have an account? Sign Up"}
        </Text>
      </Stack>
    </Flex>
  )
}
