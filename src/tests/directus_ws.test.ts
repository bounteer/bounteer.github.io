import { describe, it, expect } from "vitest";

describe("add function", () => {

    it("should fail when ws.onerror is triggered", () => {
        return new Promise((resolve, reject) => {
            const url = "wss://directus.bounteer.com/websocket";
            const ws = new WebSocket(url);
            const access_token = "dZtMfEuzhzUS0YATh0pOZfBAdOYlhowE";



            ws.onopen = () => {
                console.log("onOpen");

                const ws_payload_auth = JSON.stringify({ type: "auth", access_token: access_token });
                console.log("auth payload: " + ws_payload_auth);

                ws.send(ws_payload_auth);
                console.log("sent publish request");
            };

            ws.onmessage = async (evt) => {
                console.log("onMessage");

                const msg = JSON.parse(evt.data);
                console.log(msg);

                switch (msg.type) {
                    case "auth":
                        // subscribe to the item
                        const ws_payload_sub_submission = JSON.stringify({
                            type: "subscribe",
                            collection: "role_fit_index_submission",
                            query: {
                                fields: ["id", "status"],
                            },
                        });
                        ws.send(ws_payload_sub_submission);
                        break;

                    case "subscription":
                        const rec = Array.isArray(msg.data)
                            ? msg.data[0]
                            : msg.data?.payload ?? msg.data?.item ?? msg.data;
                        
                        switch (msg.event) {
                            case "init":
                                console.log("Subscription initialized");
                                break;
                            case "create":
                                console.log("New record created:", rec);
                                break;
                            case "update":
                                console.log("Record updated:", rec);
                                break;
                            case "delete":
                                console.log("Record deleted:", rec);
                                break;
                            default:
                                console.log("Unknown subscription event:", msg.event);
                                break;
                        }
                        break;

                    default:
                        console.log("Unknown message type:", msg.type);
                        break;
                }
            };

            ws.onerror = (error) => {
                expect(error).toBeDefined();
                reject(new Error("WebSocket error occurred"));
            };

            // Trigger an error by closing the connection immediately
            setTimeout(() => {
                ws.close();
                resolve(undefined);
            }, 1000);
        });
    });


});
