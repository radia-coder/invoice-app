import { PrismaClient } from '@prisma/client'
import { hashPassword } from '../lib/password'

// Driver type classification based on screenshots
// Colored names = Owner-Operator, Black names = Company Driver
interface DriverInfo {
  name: string;
  type: 'Owner-Operator' | 'Company Driver';
}

interface CompanyData {
  name: string;
  drivers: DriverInfo[];
}

async function main() {
  const prisma = new PrismaClient()

  const companies: CompanyData[] = [
    {
      name: 'BAKAR TRUCKING LLP',
      drivers: [
        { name: 'Wandu', type: 'Owner-Operator' }
      ]
    },
    {
      name: 'ZAMO TRUCKING LLP',
      drivers: [
        { name: 'Abdihakim elmi', type: 'Owner-Operator' },
        { name: 'Abdikani abraham', type: 'Company Driver' },
        { name: 'Abdirazaq Mohamed', type: 'Company Driver' },
        { name: 'Ahmed dahir', type: 'Company Driver' },
        { name: 'Abdirqadir hanshi', type: 'Company Driver' },
        { name: 'Ayuub Mohamed', type: 'Company Driver' },
        { name: 'Ahmed Ali', type: 'Company Driver' }
      ]
    },
    {
      name: 'WEYRAH TRANSPORTATION LLC',
      drivers: [
        { name: 'Dahir abdulle', type: 'Owner-Operator' },
        { name: 'Abdihakim shillow', type: 'Owner-Operator' },
        { name: 'Abdirahman hussein', type: 'Owner-Operator' },
        { name: 'Abdirahman Ali', type: 'Owner-Operator' },
        { name: 'Habib Hashi', type: 'Owner-Operator' },
        { name: 'Sharif Ali', type: 'Owner-Operator' },
        { name: 'Kamara', type: 'Company Driver' },
        { name: 'Abdiwahid Kediye', type: 'Company Driver' },
        { name: 'Hasan shire', type: 'Company Driver' },
        { name: 'Nuur mohamed', type: 'Company Driver' },
        { name: 'Kevan Sybiss', type: 'Company Driver' }
      ]
    },
    {
      name: 'SSS LOGISTICS LLC',
      drivers: [
        { name: 'ADAM YUSUF', type: 'Owner-Operator' },
        { name: 'Issack Rashid', type: 'Owner-Operator' },
        { name: 'Samatar Ahmed', type: 'Owner-Operator' }
      ]
    },
    {
      name: 'HADE TRANSPORTATION SERVICE LLC',
      drivers: [
        { name: 'Dikale', type: 'Owner-Operator' },
        { name: 'Jabuti Faqi', type: 'Company Driver' },
        { name: 'Mohamud Ahmed', type: 'Company Driver' },
        { name: 'Abdisalam Ahmed', type: 'Company Driver' },
        { name: 'Ishmael', type: 'Company Driver' },
        { name: 'Zakeria muse', type: 'Company Driver' },
        { name: 'Ishmail Bundo', type: 'Company Driver' },
        { name: 'Ayuub Mohamed', type: 'Company Driver' }
      ]
    },
  ]

  for (const companyData of companies) {
    // Check if company exists
    let company = await prisma.company.findFirst({
        where: { name: companyData.name }
    })

    if (!company) {
        company = await prisma.company.create({
            data: {
              name: companyData.name,
              invoice_prefix: companyData.name.substring(0, 3).toUpperCase() + '-',
              default_percent: 12.0,
              default_tax_percent: 0.0,
              default_currency: 'USD',
              invoice_template: 'classic',
              brand_color: '#2563eb'
            }
          })
          console.log(`Created company: ${company.name}`)
    } else {
        console.log(`Company already exists: ${company.name}`)
    }

    for (const driverInfo of companyData.drivers) {
      // Check if driver exists (SQLite doesn't support case-insensitive mode, use raw comparison)
      const companyDrivers = await prisma.driver.findMany({
        where: { company_id: company.id }
      })
      const existingDriver = companyDrivers.find(
        d => d.name.toLowerCase().trim() === driverInfo.name.toLowerCase().trim()
      )

      if (!existingDriver) {
        await prisma.driver.create({
            data: {
              name: driverInfo.name,
              company_id: company.id,
              type: driverInfo.type,
              status: 'active'
            }
          })
          console.log(`  - Created driver: ${driverInfo.name} (${driverInfo.type})`)
      } else {
        // Update existing driver's type if it differs
        if (existingDriver.type !== driverInfo.type) {
          await prisma.driver.update({
            where: { id: existingDriver.id },
            data: { type: driverInfo.type }
          })
          console.log(`  - Updated driver type: ${driverInfo.name} -> ${driverInfo.type}`)
        }
      }
    }
  }

  const wandu = await prisma.driver.findFirst({
    where: { name: 'Wandu' }
  })
  if (wandu) {
    await prisma.driver.update({
      where: { id: wandu.id },
      data: {
        whatsapp_number: '+905366955371',
        whatsapp_link: 'https://wa.link/5d3sga'
      }
    })
  }

  // Seed default deduction types
  const defaultDeductionTypes = ['Fuel', 'Toll', 'ELD', 'Insurance', 'Other']

  console.log('\nSeeding default deduction types...')
  for (const typeName of defaultDeductionTypes) {
    const existing = await prisma.deductionType.findFirst({
      where: { name: typeName, company_id: null, is_default: true }
    })

    if (!existing) {
      await prisma.deductionType.create({
        data: {
          name: typeName,
          company_id: null,
          is_default: true
        }
      })
      console.log(`  - Created default deduction type: ${typeName}`)
    }
  }

  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase()
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin12345'
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } })

  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email: adminEmail,
        password_hash: hashPassword(adminPassword),
        role: 'super_admin',
        company_id: null
      }
    })
    console.log(`\nCreated super admin user: ${adminEmail}`)
  } else {
    console.log(`\nSuper admin user already exists: ${adminEmail}`)
  }

  await prisma.$disconnect()
}

main()
  .catch(async (e) => {
    console.error(e)
    process.exit(1)
  })
