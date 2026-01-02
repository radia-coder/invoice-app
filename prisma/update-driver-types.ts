import { PrismaClient } from '@prisma/client'

// Driver type classification based on screenshots
// Colored names = Owner-Operator, Black names = Company Driver
const driverClassifications: Record<string, Record<string, 'Owner-Operator' | 'Company Driver'>> = {
  'BAKAR TRUCKING LLP': {
    'wandu': 'Owner-Operator',
  },
  'ZAMO TRUCKING LLP': {
    'abdihakim elmi': 'Owner-Operator',
    'abdikani abraham': 'Company Driver',
    'abdirazaq mohamed': 'Company Driver',
    'ahmed dahir': 'Company Driver',
    'abdirqadir hanshi': 'Company Driver',
    'ayuub mohamed': 'Company Driver',
    'ahmed ali': 'Company Driver',
  },
  'WEYRAH TRANSPORTATION LLC': {
    'dahir abdulle': 'Owner-Operator',
    'abdihakim shillow': 'Owner-Operator',
    'abdhakim shilow': 'Owner-Operator',
    'abdirahman hussein': 'Owner-Operator',
    'abdirahman ali': 'Owner-Operator',
    'habib hashi': 'Owner-Operator',
    'sharif ali': 'Owner-Operator',
    'kamara': 'Company Driver',
    'abdiwahid kediye': 'Company Driver',
    'hasan shire': 'Company Driver',
    'nuur mohamed': 'Company Driver',
    'nur mohamed': 'Company Driver',
    'kevan sybiss': 'Company Driver',
  },
  'SSS LOGISTICS LLC': {
    'adam yusuf': 'Owner-Operator',
    'adan yusuf': 'Owner-Operator',
    'ahmed samatar': 'Owner-Operator',
    'samatar ahmed': 'Owner-Operator',
    'issack rashid': 'Owner-Operator',
  },
  'HADE TRANSPORTATION SERVICE LLC': {
    'dikale': 'Owner-Operator',
    'jabuti faqi': 'Company Driver',
    'jabuti fiqi': 'Company Driver',
    'mohamud ahmed': 'Company Driver',
    'abdisalam ahmed': 'Company Driver',
    'ishmael': 'Company Driver',
    'ishmail bundo': 'Company Driver',
    'zakeria muse': 'Company Driver',
    'zakaria muse': 'Company Driver',
    'ayuub mohamed': 'Company Driver',
  },
}

async function main() {
  const prisma = new PrismaClient()

  console.log('Updating driver types...\n')

  // Get all drivers with their companies
  const drivers = await prisma.driver.findMany({
    include: { company: true }
  })

  let updated = 0
  let notFound = 0
  const notFoundDrivers: string[] = []

  for (const driver of drivers) {
    if (!driver.company) {
      console.log(`  [WARN] Driver has no company: ${driver.name}`)
      continue
    }

    const companyClassification = driverClassifications[driver.company.name]

    if (!companyClassification) {
      console.log(`  [WARN] No classification data for company: ${driver.company.name}`)
      continue
    }

    const normalizedName = driver.name.toLowerCase().trim()
    const newType = companyClassification[normalizedName]

    if (!newType) {
      notFound++
      notFoundDrivers.push(`${driver.name} (${driver.company.name})`)
      continue
    }

    if (driver.type !== newType) {
      await prisma.driver.update({
        where: { id: driver.id },
        data: { type: newType }
      })
      console.log(`  Updated: ${driver.name} (${driver.company.name}): ${driver.type} -> ${newType}`)
      updated++
    } else {
      console.log(`  OK: ${driver.name} (${driver.company.name}): ${driver.type}`)
    }
  }

  console.log('\n--- Summary ---')
  console.log(`Total drivers: ${drivers.length}`)
  console.log(`Updated: ${updated}`)
  console.log(`Not found in classification: ${notFound}`)

  if (notFoundDrivers.length > 0) {
    console.log('\nDrivers not found in classification (kept existing type):')
    notFoundDrivers.forEach(d => console.log(`  - ${d}`))
  }

  await prisma.$disconnect()
}

main()
  .catch(async (e) => {
    console.error(e)
    process.exit(1)
  })
