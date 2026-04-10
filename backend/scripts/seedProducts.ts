import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Product from '../src/models/Product';
import User, { IUser } from '../src/models/User';
import config from '../src/config';

dotenv.config();

const PRODUCT_CATEGORIES = [
  'Brakes',
  'Engine Parts',
  'Electrical',
  'Cooling',
  'Transmission',
  'Body Parts',
  'Accessories',
];

const BRANDS = [
  'Honda',
  'Yamaha',
  'Suzuki',
  'TVS',
  'Bajaj',
  'KTM',
  'Hero',
  'Kawasaki',
  'Castrol',
  'Bosch',
];

const PART_NAMES = [
  'Brake Pad Set',
  'Chain Sprocket Kit',
  'Clutch Plate Kit',
  'Engine Oil Filter',
  'Headlight Assembly',
  'Air Filter Element',
  'Radiator Coolant Hose',
  'Battery 12V',
  'Front Fork Seal',
  'Spark Plug Set',
  'Rear Shock Absorber',
  'Fuel Pump Module',
  'Disc Rotor',
  'Indicator Lamp Set',
  'Starter Motor',
  'Handlebar Grip Set',
  'Side Mirror Pair',
  'Throttle Cable',
  'Brake Fluid DOT4',
  'Performance Exhaust',
];

const IMAGE_URLS = [
  'https://images.pexels.com/photos/2116475/pexels-photo-2116475.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/2393821/pexels-photo-2393821.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/1715193/pexels-photo-1715193.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/2549941/pexels-photo-2549941.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/18296/pexels-photo.jpg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/1719648/pexels-photo-1719648.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/2116469/pexels-photo-2116469.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/100582/pexels-photo-100582.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/1715192/pexels-photo-1715192.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/163210/motorcycle-race-helmets-pilots-163210.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/2393819/pexels-photo-2393819.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/995301/pexels-photo-995301.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/1119796/pexels-photo-1119796.jpeg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/13861/IMG_3496bfree.jpg?auto=compress&cs=tinysrgb&w=1200',
  'https://images.pexels.com/photos/1309772/pexels-photo-1309772.jpeg?auto=compress&cs=tinysrgb&w=1200',
];

const OTHER_SELLERS = [
  {
    firstName: 'Nimal',
    lastName: 'Silva',
    email: 'seller2@gmail.com',
    phone: '+94 71 234 5678',
    shopName: 'Silva Motors & Parts',
    shopDescription: 'Genuine and aftermarket motorcycle parts for daily riders and enthusiasts.',
    shopLocation: '12/B, Kandy Road, Peradeniya',
  },
  {
    firstName: 'Chathura',
    lastName: 'Mendis',
    email: 'seller3@gmail.com',
    phone: '+94 77 201 9044',
    shopName: 'MotoHub Colombo',
    shopDescription: 'Urban store focused on premium bike accessories and performance upgrades.',
    shopLocation: 'Union Place, Colombo 02',
  },
  {
    firstName: 'Asanka',
    lastName: 'Jayasuriya',
    email: 'seller4@gmail.com',
    phone: '+94 76 558 1190',
    shopName: 'Southern Riders Supply',
    shopDescription: 'Trusted spare parts partner for riders in Southern province.',
    shopLocation: 'Matara Road, Galle',
  },
  {
    firstName: 'Rashmi',
    lastName: 'Ekanayake',
    email: 'seller5@gmail.com',
    phone: '+94 70 991 6234',
    shopName: 'Hill Country Bike Store',
    shopDescription: 'Complete range of quality parts for mountain and city bikes.',
    shopLocation: 'Peradeniya Road, Kandy',
  },
  {
    firstName: 'Tharindu',
    lastName: 'Fernando',
    email: 'seller6@gmail.com',
    phone: '+94 75 333 8181',
    shopName: 'SpeedLine Moto Traders',
    shopDescription: 'Focused on fast-moving inventory, protective gear, and racing components.',
    shopLocation: 'Negombo Road, Ja-Ela',
  },
];

const randomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const pick = <T>(items: T[]): T => {
  return items[randomInt(0, items.length - 1)];
};

const formatSku = (prefix: string, index: number): string => {
  return `${prefix}-${String(index + 1).padStart(3, '0')}`;
};

const ensureSeller = async (data: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  shopName: string;
  shopDescription: string;
  shopLocation: string;
}): Promise<IUser> => {
  let seller = await User.findOne({ email: data.email, role: 'seller' });

  if (!seller) {
    seller = await User.create({
      ...data,
      role: 'seller',
      password: 'seller123',
      isEmailVerified: true,
      isActive: true,
      approvalStatus: 'approved',
      approvedAt: new Date(),
    });
  }

  await User.updateOne(
    { _id: seller._id },
    {
      $set: {
        isActive: true,
        isEmailVerified: true,
        approvalStatus: 'approved',
        approvedAt: new Date(),
        shopName: data.shopName,
        shopDescription: data.shopDescription,
        shopLocation: data.shopLocation,
      },
    }
  );

  const fresh = await User.findById(seller._id);
  if (!fresh) {
    throw new Error(`Failed to load seller account: ${data.email}`);
  }

  return fresh;
};

const buildProductDoc = (
  sellerId: mongoose.Types.ObjectId,
  sku: string,
  seedIndex: number,
  shopLabel: string
) => {
  const brand = pick(BRANDS);
  const part = pick(PART_NAMES);
  const category = pick(PRODUCT_CATEGORIES);
  const basePrice = randomInt(2500, 95000);
  const originalPrice = basePrice + randomInt(500, 12000);
  const stock = randomInt(3, 80);
  const imageOne = IMAGE_URLS[seedIndex % IMAGE_URLS.length];
  const imageTwo = IMAGE_URLS[(seedIndex + 5) % IMAGE_URLS.length];
  const name = `${brand} ${part}`;

  return {
    seller: sellerId,
    name,
    description: `${name} for motorcycles. Offered by ${shopLabel}. Durable quality, quick delivery, and island-wide availability.`,
    category,
    brand,
    price: basePrice,
    originalPrice,
    stock,
    images: [imageOne, imageTwo],
    sku,
    status: 'active' as const,
    type: 'product' as const,
    views: randomInt(10, 2500),
    sales: randomInt(0, 420),
  };
};

const seedProducts = async (): Promise<void> => {
  try {
    await mongoose.connect(config.mongoURI);
    console.log('MongoDB Connected');

    const mainSeller = await ensureSeller({
      firstName: 'Kamal',
      lastName: 'Perera',
      email: 'seller@gmail.com',
      phone: '+94 77 123 4567',
      shopName: 'Kamal Auto Parts',
      shopDescription: 'Premium quality spare parts for Japanese and European motorcycles.',
      shopLocation: 'No. 45, Galle Road, Colombo 03',
    });

    const otherSellers = await Promise.all(OTHER_SELLERS.map((s) => ensureSeller(s)));

    const primaryProducts = Array.from({ length: 30 }).map((_, index) => {
      const sku = formatSku('FM-KAMAL', index);
      return buildProductDoc(mainSeller._id, sku, index, mainSeller.shopName || 'Kamal Auto Parts');
    });

    const marketplaceProducts = Array.from({ length: 100 }).map((_, index) => {
      const seller = otherSellers[index % otherSellers.length];
      const sellerLabel = seller.shopName || `${seller.firstName} ${seller.lastName}`;
      const sku = formatSku(`FM-SHOP-${(index % otherSellers.length) + 1}`, index);
      return buildProductDoc(seller._id, sku, index + 100, sellerLabel);
    });

    const allProducts = [...primaryProducts, ...marketplaceProducts];

    const ops = allProducts.map((doc) => ({
      updateOne: {
        filter: { seller: doc.seller, sku: doc.sku },
        update: { $set: doc },
        upsert: true,
      },
    }));

    const result = await Product.bulkWrite(ops, { ordered: false });

    console.log(`Seeded/updated products for ${mainSeller.email} and marketplace sellers.`);
    console.log(`Upserted: ${result.upsertedCount || 0}, Modified: ${result.modifiedCount || 0}, Matched: ${result.matchedCount || 0}`);
    console.log('Created dataset: 30 products for seller@gmail.com + 100 products across other shops.');
    console.log('\nSeller credentials for testing:');
    console.log('seller@gmail.com / seller123');
    console.log('seller2@gmail.com / seller123');
    console.log('seller3@gmail.com / seller123');
    console.log('seller4@gmail.com / seller123');
    console.log('seller5@gmail.com / seller123');
    console.log('seller6@gmail.com / seller123');

    await mongoose.disconnect();
    console.log('Done.');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding products:', error);
    process.exit(1);
  }
};

seedProducts();
