export const DIRECTUS_URL = 'https://directus.ismail.to';

export default async function fetchBlogPostModel(): Promise<BlogPostResponseData[]> {
    const fields = [
        "id",
        "slug",
        "subject",
        "content",
        "category",
        "date_created",
        "og_image"
    ].join(',');

    const res = await fetch(`${DIRECTUS_URL}/items/blog_posts?fields=${fields}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch blog posts: ${res.statusText},\nreturned: ${await res.text()}`);
    }

    const json: BlogPostResponse = await res.json();
    return json.data.map((post) => ({
        id: post.slug,
        title: post.subject,
        excerpt: post.content.replace(/<[^>]+>/g, '').slice(0, 180) + "...",
        date: new Date(post.date_created).toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
        }),
        author: "Admin",
        authorRole: "Content Writer",
        authorAvatar: "https://randomuser.me/api/portraits/lego/1.jpg",
        category: post.category,
        image: post.og_image ? `${DIRECTUS_URL}/assets/${post.og_image}` : null,
    }));
}

export interface BlogPostResponse {
    data: BlogPostRaw[];
}

export interface BlogPostRaw {
    id: number;
    slug: string;
    subject: string;
    content: string;
    category: string;
    date_created: string;
    og_image: string | null;
}

export interface BlogPostResponseData {
    id: string;
    title: string;
    excerpt: string;
    date: string;
    author: string;
    authorRole: string;
    authorAvatar: string;
    category: string;
    image: string | null;
}