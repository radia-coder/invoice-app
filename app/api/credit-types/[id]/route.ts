import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { requireApiAuth } from '@/lib/api-auth'

// DELETE /api/credit-types/[id]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, response, isSuperAdmin } = await requireApiAuth()
  if (response) return response

  const { id } = await params
  const typeId = parseInt(id)

  if (isNaN(typeId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }

  try {
    const creditType = await prisma.creditType.findUnique({
      where: { id: typeId }
    })

    if (!creditType) {
      return NextResponse.json({ error: 'Credit type not found' }, { status: 404 })
    }

    // Prevent deletion of default types
    if (creditType.is_default) {
      return NextResponse.json({ error: 'Cannot delete default credit type' }, { status: 400 })
    }

    // Only allow deletion if it belongs to user's company or user is super admin
    if (!isSuperAdmin && creditType.company_id !== user?.company_id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    await prisma.creditType.delete({
      where: { id: typeId }
    })

    return NextResponse.json({ message: 'Credit type deleted successfully' })
  } catch (error) {
    console.error('Error deleting credit type:', error)
    return NextResponse.json({ error: 'Failed to delete credit type' }, { status: 500 })
  }
}
