const DIRECTUS_URL = "https://directus.bounteer.to";

/**
 * TODO implement websocket pubsub of sttus report status change
 */
export async function waitForSubmissionStatusChange(
    id: number,
    accessToken: string
): Promise<ReportData> {
    return new Promise((resolve, reject) => {
        const ws = new WebSocket(
            `${DIRECTUS_URL.replace("http", "ws")}/websocket?access_token=${accessToken}`
        );

        ws.onopen = () => {
            console.log("Connected to Directus WS, subscribing…");
            ws.send(
                JSON.stringify({
                    type: "subscribe",
                    collection: "blog_post",
                    event: "items.update",
                })
            );
        };

        ws.onerror = (err) => {
            reject(new Error("WebSocket error: " + JSON.stringify(err)));
        };

        ws.onmessage = async (msg) => {
            try {
                const data = JSON.parse(msg.data);

                // We only care about subscription events
                if (data.type !== "subscription" || !data.event) return;

                // Directus provides updated item IDs in payload.keys
                const updatedId = data?.payload?.keys?.[0];
                if (Number(updatedId) === id) {
                    console.log(`Detected update for submission ${id}`);

                    // Fetch updated report (report id to be stored at submission ids)
                    // const res = await fetch(
                    //     `${DIRECTUS_URL}/items/blog_post/${id}?fields=id,slug,subject,content,category,date_created,og_image,user_created.first_name,user_created.last_name,user_created.avatar,user_created.role.name`,
                    //     {
                    //         headers: {
                    //             Authorization: `Bearer ${accessToken}`,
                    //         },
                    //     }
                    // );

                    // if (!res.ok) {
                    //     throw new Error(
                    //         `Failed to fetch updated blog post: ${res.statusText},\nreturned: ${await res.text()}`
                    //     );
                    // }

                    const mapped: ReportData = {
                        id: id
                    };

                    ws.close();
                    resolve(mapped);
                }
            } catch (err) {
                reject(err);
            }
        };
    });
}


export interface ReportData {
    id: number;
    // fill in data when set up
}

export interface SubmissionReportData {
    tags_id: {
        name: string;
    };
}

export interface SubmissionReportesponse {
    data: SubmissionReportData[];
}
