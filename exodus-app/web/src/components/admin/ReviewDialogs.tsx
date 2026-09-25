// The two confirmation dialogs of the admin page.
//
// Approve is not a one-click action on purpose: it creates things on the
// ledger (Alice's party, her ledger user and her ClientAccess pass).
import { useState } from 'react'
import { toast } from 'sonner'
import { useApproveApplication, useRejectApplication } from '@/api/hooks'
import type { ApplicationForReview } from '@/api/types'
import { FormError } from '@/components/FormError'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'

// Same limit as the API (RejectApplicationDto).
const MAX_REASON_LENGTH = 500

type ReviewDialogProps = {
  // The application being reviewed; null = dialog closed.
  application: ApplicationForReview | null
  onClose: () => void
}

export function ApproveDialog({ application, onClose }: ReviewDialogProps) {
  const approve = useApproveApplication()

  function handleApprove() {
    if (application === null) {
      return
    }
    approve.mutate(application.id, {
      onSuccess: () => {
        toast.success(`${application.fullName} is approved. Their wallet is ready.`)
        closeDialog()
      },
    })
  }

  // Clear the last error, so the next dialog starts clean.
  function closeDialog() {
    approve.reset()
    onClose()
  }

  return (
    <Dialog open={application !== null} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-[22px] font-medium">Approve {application?.fullName}?</DialogTitle>
          <DialogDescription>
            This creates their Canton party and ledger user, and an access pass signed by the Operator. They can then
            use the faucet, subscribe to USYC and send tokens to other approved clients.
          </DialogDescription>
        </DialogHeader>
        <FormError error={approve.error} />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="bright" onClick={handleApprove} disabled={approve.isPending}>
            {approve.isPending ? 'Creating wallet…' : 'Approve'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function RejectDialog({ application, onClose }: ReviewDialogProps) {
  const reject = useRejectApplication()
  const [reason, setReason] = useState('')

  function handleReject() {
    if (application === null) {
      return
    }
    reject.mutate(
      { applicationId: application.id, reason },
      {
        onSuccess: () => {
          toast.success(`${application.fullName}'s application was rejected.`)
          closeDialog()
        },
      },
    )
  }

  function closeDialog() {
    reject.reset()
    setReason('')
    onClose()
  }

  return (
    <Dialog open={application !== null} onOpenChange={(open) => !open && closeDialog()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="font-display text-[22px] font-medium">Reject {application?.fullName}?</DialogTitle>
          <DialogDescription>They will see your reason and can apply again.</DialogDescription>
        </DialogHeader>
        <Field>
          <FieldLabel htmlFor="rejectionReason">Reason (optional)</FieldLabel>
          <Textarea
            id="rejectionReason"
            maxLength={MAX_REASON_LENGTH}
            placeholder="For example: please use your full legal name."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <FieldDescription>
            {reason.length}/{MAX_REASON_LENGTH}
          </FieldDescription>
        </Field>
        <FormError error={reject.error} />
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button variant="destructive" onClick={handleReject} disabled={reject.isPending}>
            {reject.isPending ? 'Rejecting…' : 'Reject'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
