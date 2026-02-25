'use client';

const SITE_URL = 'https://marianoaliandri.com.ar';
const DEFAULT_IMAGE = `${SITE_URL}/og-image.jpg`;
const SITE_NAME = 'Mariano Aliandri Portfolio';

const SEO = ({
  title,
  description,
  canonical,
  robots,
  ogType = 'website',
  ogImage,
  twitterCard = 'summary_large_image',
  jsonLd,
}) => {
  const canonicalUrl = canonical
    ? `${SITE_URL}${canonical.endsWith('/') ? canonical : canonical + '/'}`
    : `${SITE_URL}/`;
  const image = ogImage || DEFAULT_IMAGE;

  return (
    <>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      {robots && <meta name="robots" content={robots} />}

      {/* Open Graph */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content="es_AR" />

      {/* Twitter Card */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />

      {/* Structured Data JSON-LD */}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
    </>
  );
};

export default SEO;
export { SITE_URL };
