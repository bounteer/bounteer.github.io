import { EXTERNAL } from '@/constant';

export default async function fetchBlogPostModel(): Promise<BlogPostResponseData[]> {
    const quality = 50;
    const sort = "sort=-date_created";
    const filter = "filter[is_enabled][_eq]=true";
    const fields = [
        "id",
        "slug",
        "subject",
        "content",
        "category",
        "date_created",
        "og_image",
        "user_created.first_name",
        "user_created.last_name",
        "user_created.avatar",
        "user_created.role.name"
    ].join(',');

    const res = await fetch(`${EXTERNAL.directus_url}/items/blog_post?${sort}&${filter}&fields=${fields}`);
    if (!res.ok) {
        throw new Error(`Failed to fetch blog posts: ${res.statusText},\nreturned: ${await res.text()}`);
    }

    const json: BlogPostResponse = await res.json();
    return json.data.map((post) => {
        const fullName =
            post.user_created?.first_name && post.user_created?.last_name
                ? `${post.user_created.first_name} ${post.user_created.last_name}`
                : "Admin";

        const avatar = post.user_created?.avatar
            ? `${EXTERNAL.directus_url}/assets/${post.user_created.avatar}?quality=${quality}`
            : "https://randomuser.me/api/portraits/lego/1.jpg";

        return {
            slug: post.slug,
            title: post.subject,
            excerpt: post.content.replace(/<[^>]+>/g, "").slice(0, 180) + "...",
            date: new Date(post.date_created).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
            }),
            author: fullName,
            authorRole: post.user_created?.role?.name || "Content Writer",
            authorAvatar: avatar,
            category: post.category,
            image: post.og_image
                ? `${EXTERNAL.directus_url}/assets/${post.og_image}?quality=${quality}`
                : "/gradient.jpg",
        };
    });
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
    user_created?: {
        first_name?: string;
        last_name?: string;
        avatar?: string;
        role?: {
            name?: string;
        };
    };
}

export interface BlogPostResponseData {
    slug: string;
    title: string;
    excerpt: string;
    date: string;
    author: string;
    authorRole: string;
    authorAvatar: string;
    category: string;
    image: string | null;
}