import { useEffect, useState } from 'react';
import fetchBlogPostModel, { DIRECTUS_URL, type BlogPostResponseData } from '../fetch/BlogPosts';

export default function BlogGrid() {
    const [posts, setPosts] = useState<BlogPostResponseData[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchBlogPostModel()
            .then(setPosts)
            .catch((err) => console.error("Blog fetch failed", err))
            .finally(() => setLoading(false));
    }, []);
    if (loading) return <p>Loading blog posts...</p>;

    return (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post, index) => (
                <div
                    key={post.id}
                    className="card border border-gray-200 dark:border-gray-700 overflow-hidden slide-up"
                    style={{ animationDelay: `${index * 100}ms` }}
                >
                    <a href={`/blog/${post.id}`} className="block">
                        <img
                            src={post.image ?? '/gradient.jpg'}
                            alt={post.title}
                            className="w-full h-48 object-cover"
                            loading="lazy"
                        />
                    </a>
                    <div className="p-6">
                        <div className="flex items-center mb-4">
                            <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                                {post.category}
                            </span>
                            <span className="mx-2 text-gray-300 dark:text-gray-600">•</span>
                            <span className="text-sm text-gray-500 dark:text-gray-400">{post.date}</span>
                        </div>
                        <a href={`/blog/${post.id}`} className="block mb-3">
                            <h2 className="text-xl font-semibold text-gray-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                                {post.title}
                            </h2>
                        </a>
                        <p className="text-gray-600 dark:text-gray-300 mb-6">{post.excerpt}</p>
                        <div className="flex items-center">
                            <img
                                src={post.authorAvatar}
                                alt={post.author}
                                className="w-10 h-10 rounded-full mr-3 object-cover"
                                loading="lazy"
                            />
                            <div>
                                <p className="font-medium text-gray-900 dark:text-white">{post.author}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">{post.authorRole}</p>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}