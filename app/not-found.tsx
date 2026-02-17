import Link from "next/link"
import { IconArrowLeft, IconMoodSad } from "@tabler/icons-react"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
        <IconMoodSad className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="text-xl font-bold">Page not found</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Button asChild variant="outline" className="gap-2">
        <Link href="/dashboard">
          <IconArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </Button>
    </div>
  )
}
