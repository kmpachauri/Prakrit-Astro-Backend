const LandingPage = require('../models/LandingPage');
const SiteSetting = require('../models/SiteSetting');
const FAQ = require('../models/FAQ');

const SLUG = 'prakrit-career-boost';
const CONTENT_VERSION = 7;
let defaultFaqsEnsured = false;

const normalizeFaqKey = (question = '', answer = '') =>
  `${question}::${answer}`.trim().toLowerCase();

const isPlainObject = (value) =>
  Object.prototype.toString.call(value) === '[object Object]';

const mergeMissingDefaults = (existingValue, defaultValue) => {
  if (Array.isArray(defaultValue)) {
    return Array.isArray(existingValue) ? existingValue : defaultValue;
  }

  if (isPlainObject(defaultValue)) {
    const safeExisting = isPlainObject(existingValue) ? existingValue : {};
    return Object.keys(defaultValue).reduce(
      (acc, key) => {
        acc[key] = mergeMissingDefaults(safeExisting[key], defaultValue[key]);
        return acc;
      },
      { ...safeExisting }
    );
  }

  return existingValue === undefined ? defaultValue : existingValue;
};

const funnelContent = {
    generalSection: {
      brandName: 'Prakrit Astro',
      headerTagline: 'ज्योतिष से सही दिशा, बच्चे का सुनहरा भविष्य',
      supportLabel: 'सपोर्ट',
      whatsappMessage: 'Hello, I have a query about Prakrit Astro.'
    },
    announcementBar: 'सीमित सीटें उपलब्ध | केवल इस बैच के लिए ₹77/- विशेष ऑफर',
    hero: {
      question: 'क्या आपका बच्चा 8वीं, 9वीं या 10वीं क्लास में है?',
      headline: 'भेड़चाल में आकर कहीं आप भी अपने बच्चे के कीमती 5 साल और लाखों रुपये बर्बाद तो नहीं कर रहे?',
      subheadline: 'जानिए उसका जन्मजात Natural टैलेंट और सही करियर दिशा - सीधे उसकी जन्मकुंडली के ग्रहों से!',
      masterclassTag: '1 घंटे की लाइव ऑनलाइन मास्टरक्लास',
      ctaText: 'हाँ! मैं अपने बच्चे की सीट सुरक्षित करना चाहता हूँ - बुक नाउ',
      priceNote: 'केवल इस बैच के लिए'
    },
    careerDirectionSection: {
      kicker: 'क्यों जरूरी है सही करियर दिशा?',
      headline: 'क्या आप सही करियर दिशा के बिना अपने बच्चे के साल और पैसे जोखिम में डाल रहे हैं?',
      priceLabel: '1 घंटे की लाइव मास्टरक्लास',
      questions: [
        'बच्चा किस क्षेत्र में सबसे अच्छा करेगा?',
        'कौन-सा करियर उसके स्वभाव और क्षमता के अनुसार है?',
        'भविष्य में किस क्षेत्र में सफलता की संभावना अधिक है?'
      ]
    },
    problemSection: {
      title: 'आज के माता-पिता की सबसे बड़ी 3 गलतियाँ',
      problems: [
        { title: 'शर्मा जी का बेटा जो कर रहा है, वही मेरा बच्चा करेगा', desc: 'दोस्तों और पड़ोसियों को देखकर स्ट्रीम Science/Commerce चुनना।' },
        { title: 'महंगी कोचिंग पर अंधाधुंध खर्च', desc: 'बिना यह जाने कि बच्चे का दिमाग उस विषय के लिए बना भी है या नहीं, लाखों रुपये लुटा देना।' },
        { title: '25 साल की उम्र में भ्रम Confusion', desc: 'ग्रेजुएशन पूरी करने के बाद भी युवाओं का यह न जान पाना कि उन्हें जीवन में करना क्या है।' }
      ],
      solutionSubtitle: 'समाधान? बच्चे की कुंडली में छिपा उसका “प्राकृत” Inborn ब्लूप्रिंट!'
    },
    insideSection: {
      title: 'आप इस मास्टरक्लास में क्या सीखेंगे?',
      points: [
        { title: 'जन्मकुंडली विश्लेषण', desc: 'ग्रहों की स्थिति के आधार पर बच्चे की प्रमुख क्षमताओं की पहचान।' },
        { title: 'नेचुरल टैलेंट पहचान', desc: 'बच्चे की विशेष रुचियों और प्राकृतिक गुणों को समझना।' },
        { title: 'सही करियर दिशा', desc: 'भविष्य में सफलता के लिए उपयुक्त करियर विकल्पों का चयन।' },
        { title: 'भविष्य की संभावनाएँ', desc: 'आने वाले समय में बेहतर अवसर और संभावित चुनौतियों का विश्लेषण।' },
        { title: 'लाइव Q&A', desc: 'आपके सभी सवालों के स्पष्ट और व्यावहारिक उत्तर।' }
      ]
    },
    revealSection: {
      title: 'मास्टरक्लास का महा-आकर्षण',
      subtitle: 'विशेष अवसर',
      desc: 'इस लाइव वर्कशॉप में शामिल होने वाले चुनिंदा पेरेंट्स को हमारे प्रीमियम 2 घंटे के वन-टू-वन पर्सनल गाइडेंस प्रोग्राम में प्रवेश का मौका मिलेगा।',
      bullets: [
        '2 घंटे की पर्सनल ज़ूम मीटिंग सीधे हमारे मुख्य काउंसलर के साथ',
        '5 साल तक व्हाट्सएप पर करियर प्रोग्रेस सपोर्ट 10वीं से कॉलेज तक',
        'कस्टमाइज्ड प्राकृत करियर कुंडली पीडीएफ रिपोर्ट',
        'बच्चे के ग्रहों के अनुसार भाग्य रत्न + धन रत्न + ख्याति रत्न का लॉकेट पेंडेंट'
      ]
    },
    mentorSection: {
      title: 'मिलिए अपने मार्गदर्शक से',
      name: 'Pandit Ramendra & Rekha',
      role: 'Director - Tattoobaba Art Factory Pvt. Ltd. & Founder - Prakrit Career Jyotish',
      quote: 'एक बिजनेस लीडर और करियर कंसल्टेंट के रूप में, मैंने देखा है कि कैसे युवा गलत करियर चुनकर जिंदगी के सबसे कीमती साल गंवा देते हैं। मेरा मिशन प्राकृत ज्योतिष के प्राचीन विज्ञान को आधुनिक करियर काउंसलिंग से जोड़कर, 8वीं से 10वीं के बच्चों को उनके जीवन की सही “प्राकृत” दिशा दिखाना है।',
      brandLine: 'ASTRO & GEMS 369',
      bullets: [
        '36+ वर्षों का प्राकृत ज्योतिष अनुभव',
        'हजारों बच्चों और परिवारों को सही दिशा देने का अनुभव',
        'टैरो, ज्योतिष, अंक ज्योतिष एवं रत्न विज्ञान में विशेषज्ञता'
      ]
    },
    testimonialSection: {
      titlePrefix: 'संतुष्ट माता-पिता के',
      titleHighlight: 'अनुभव'
    },
    faqSection: {
      titlePrefix: 'अक्सर पूछे जाने वाले',
      titleHighlight: 'सवाल (FAQ)'
    },
    footerSection: {
      headline: 'अंतिम आमंत्रण',
      countdownLabel: 'ऑफर समाप्त होने में शेष समय',
      urgencyTitle: 'समय तेजी से निकल रहा है, और आपके बच्चे का भविष्य दांव पर है!',
      urgencyDesc: 'सीटें सीमित हैं केवल 100 पैरेंट्स प्रति बैच',
      urgencyPrice: 'आज ही रजिस्टर करें - मात्र ₹77/- में',
      ctaText: 'अपने बच्चे का भविष्य सुरक्षित करें - अभी बुक करें',
      bullets: [
        'लाइव ऑनलाइन मास्टरक्लास',
        'बच्चे की सही करियर दिशा जानें',
        'सुरक्षित भविष्य की ओर कदम बढ़ाएं'
      ],
      trustBadges: ['Secure Payment', 'No Fake Promises', 'Privacy Protected'],
      secureText: 'Secure payment via trusted gateway'
    },
    siteFooterSection: {
      links: [
        { label: 'Privacy Policy', href: '/privacy-policy' },
        { label: 'Terms & Conditions', href: '/terms' },
        { label: 'Refund Policy', href: '/refund-policy' },
        { label: 'Contact Support', href: '/contact' }
      ],
      copyrightName: 'Prakrit Astro'
    }
};

const content = {
  hinglish: funnelContent,
  hindi: funnelContent,
  english: funnelContent
};

const faqItems = [
  {
    order: 1,
    question: 'क्या इसके लिए बच्चे की सटीक जन्म तिथि और समय होना जरूरी है?',
    answer: 'हाँ, सटीक कुंडली विश्लेषण के लिए बच्चे की जन्म तिथि, समय और जन्म स्थान की आवश्यकता होगी। वर्कशॉप में हम इसका महत्व समझाएंगे।',
    isActive: true
  },
  {
    order: 2,
    question: '₹77/- इतनी कम फीस क्यों है?',
    answer: 'हम चाहते हैं कि हर गंभीर माता-पिता बिना किसी वित्तीय बोझ के अपने बच्चे के भविष्य के लिए सही निर्णय ले सके। यह फीस केवल गंभीर लोगों को फिल्टर करने के लिए है।',
    isActive: true
  },
  {
    order: 3,
    question: 'यह वर्कशॉप कहाँ होगी?',
    answer: 'यह पूरी तरह ऑनलाइन होगी। रजिस्ट्रेशन के बाद आपको आपके व्हाट्सएप और ईमेल पर मास्टरक्लास डिटेल्स मिल जाएंगी।',
    isActive: true
  },
  {
    order: 4,
    question: 'क्या यह केवल 8वीं, 9वीं और 10वीं के बच्चों के लिए है?',
    answer: 'हाँ, यह मास्टरक्लास खास तौर पर 8वीं, 9वीं और 10वीं क्लास के बच्चों के पेरेंट्स के लिए बनाई गई है।',
    isActive: true
  },
  {
    order: 5,
    question: 'पेमेंट के बाद मुझे क्या करना होगा?',
    answer: 'पेमेंट सफल होने के बाद सक्सेस पेज पर व्हाट्सएप ग्रुप जॉइन बटन दिखेगा। वहीं से आप आगे की मास्टरक्लास निर्देश प्राप्त करेंगे।',
    isActive: true
  },
  {
    order: 6,
    question: 'क्या यह साइंस, कॉमर्स और आर्ट्स सिलेक्शन में मदद करेगा?',
    answer: 'हाँ, वर्कशॉप में स्ट्रीम सिलेक्शन को कुंडली के इंडिकेटर्स और बच्चे की नेचुरल प्रवृत्ति के संदर्भ में समझाया जाएगा।',
    isActive: true
  },
  {
    order: 7,
    question: 'अगर मुझे पेमेंट इश्यू आए तो?',
    answer: 'पेमेंट फेल या डुप्लीकेट पेमेंट के केस में व्हाट्सएप सपोर्ट पर अपना रजिस्टर्ड मोबाइल नंबर और ऑर्डर आईडी शेयर करें।',
    isActive: true
  }
];

const defaultFAQs = faqItems.map((item) => ({ ...item, language: 'hinglish' }));

const defaultPage = {
  name: 'Prakrit Career Boost',
  slug: SLUG,
  templateKey: 'prakrit_career_boost',
  isActive: true,
  status: 'active',
  content,
  pricing: {
    originalPrice: 1999,
    offerPrice: 77,
    personalizedOriginalPrice: 4999,
    personalizedOfferPrice: 999,
    currency: 'INR'
  },
  settings: {
    whatsappNumber: '+919999999999',
    supportEmail: 'theoccultschool1356@gmail.com',
    businessAddress: 'R.S. Sharma, Pent House 01, Yash Residence, Ward No. 78, Bali Vihar, Mansarovar, Sanganer, Jaipur, Rajasthan - 302029',
    countdownEnabled: true,
    countdownHours: 6,
    countdownMinutes: 0,
    paymentEnabled: true,
    whatsappGroupLink: '',
    formFields: {
      name: { visible: true, label: 'Parent Name / माता-पिता का नाम', required: true },
      mobile: { visible: true, label: 'Mobile Number', required: true },
      email: { visible: true, label: 'Email', required: false },
      careerCategory: { visible: true, label: 'Student Class / Class', required: true },
      notes: { visible: true, label: 'Child ke career/stream concern', required: false }
    },
    contentVersion: CONTENT_VERSION
  }
};

async function ensureCareerBoostPage() {
  let page = await LandingPage.findOne({ slug: SLUG });

  if (!page) {
    page = await LandingPage.create(defaultPage);
  } else if ((page.settings?.contentVersion || 1) < CONTENT_VERSION) {
    page.name = defaultPage.name;
    page.templateKey = defaultPage.templateKey;
    page.isActive = true;
    page.status = 'active';
    page.content = mergeMissingDefaults(page.content, defaultPage.content);
    page.pricing = mergeMissingDefaults(page.pricing, defaultPage.pricing);
    page.settings = {
      ...mergeMissingDefaults(page.settings, defaultPage.settings),
      ...(page.settings || {}),
      contentVersion: CONTENT_VERSION
    };
    await page.save();
  } else if (!page.isActive) {
    page.isActive = true;
    page.status = 'active';
    await page.save();
  }

  let settings = await SiteSetting.findOne();
  if (!settings) {
    settings = await SiteSetting.create({
      websiteName: 'Prakrit Astro',
      logoUrl: '/images/profile_logo.jpeg',
      defaultLanguage: 'hinglish',
      activeLandingPageId: page._id,
      paymentGateway: 'razorpay',
      whatsappNumber: page.settings?.whatsappNumber || '',
      supportEmail: page.settings?.supportEmail || '',
      businessAddress: page.settings?.businessAddress || ''
    });
  } else if (String(settings.activeLandingPageId || '') !== String(page._id)) {
    settings.activeLandingPageId = page._id;
    await settings.save();
  }

  if (!defaultFaqsEnsured) {
    const existingFaqs = await FAQ.find().sort({ createdAt: 1 });
    const seenFaqs = new Set();

    for (const faq of existingFaqs) {
      const key = normalizeFaqKey(faq.question, faq.answer);
      if (!key || seenFaqs.has(key)) {
        await FAQ.deleteOne({ _id: faq._id });
        continue;
      }
      seenFaqs.add(key);
    }

    const faqCount = await FAQ.countDocuments();
    if (faqCount === 0) {
      for (const faq of defaultFAQs) {
        await FAQ.create(faq);
      }
    }

    defaultFaqsEnsured = true;
  }

  return page;
}

module.exports = {
  SLUG,
  ensureCareerBoostPage
};
