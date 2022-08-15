import React, { useState, useEffect, useContext, useRef } from "react";
import styles from './ChatBox.module.css';
import { Orbis } from "../index.js";
import { getAddressFromDid } from "../utils";

/** Initialize the Orbis class object */
let _orbis = new Orbis();

export function ChatBox({orbis, context}) {
  if(orbis) {
    return(
      <ChatBoxContent orbis={orbis} context={context} />
    )
  } else {
    return(
      <ChatBoxContent orbis={_orbis} context={context} />
    );
  }
}

/** Orbis contact module */
function ChatBoxContent({orbis, context}) {
  const [user, setUser] = useState();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [replyTo, setReplyTo] = useState();
  const [replyToText, setReplyToText] = useState();

  /** Used to reply to a specific post */
  function reply(message) {
    if(message) {
      setReplyTo(message.stream_id);
      setReplyToText(message.content.body);
    } else {
      setReplyTo(null);
      setReplyToText(null);
    }
  }

  /** Load messages sent in channel on load */
  useEffect(() => {
    if(expanded) {
      getIsConnected();
      getSupportChannelMessages();
    }

    /** Check if user is connected */
    async function getIsConnected() {
      let res = await orbis.isConnected();

      /** If SDK returns user details we save it in state */
      if(res && res.status == 200) {
        setUser(res.details);
      }
    }

    /** Load messages */
    async function getSupportChannelMessages() {
      setLoading(true);
      let { data, error } = await orbis.getPosts({ context: context });
      setLoading(false);
      setMessages(data);
    }
  }, [expanded])

  return(
    <div className={styles.chatBoxContainer}>
      {/** CTA to open the contact module */}
      <div className={styles.chatBoxContainerCta} onClick={() => setExpanded(!expanded)}>
        {expanded ?
          <img src="/img/icons/question-close.png" height="27" />
        :
          <img src="/img/icons/question-message.png" height="27" />
        }
      </div>

      {/** Expanded view of the contact module */}
      {expanded &&
        <div className={styles.chatBoxContainerExpanded}>
          <div className={styles.chatBoxHead}>
            <p>Ask your questions to the Cerscan community.</p>
            <p style={{marginTop: 5}}>
              <a href="https://orbis.club" target="_blank" rel="noreferrer">
                <img src="/img/powered-by-orbis.png" height="16" />
              </a>
            </p>
          </div>
          {/** List messages sent in the group */}
          <div className={styles.chatBoxMessagesContainer}>
            {loading &&
              <p className={styles.secondary} style={{width: "100%", textAlign: "center"}}><img src="/img/icons/question-spinner-black.png" className={styles.loadingSpinner}/></p>
            }
            <Messages
              user={user}
              messages={messages}
              reply={reply}
              replyTo={replyTo} />

          </div>

          {/** Display input */}
          <div className={styles.chatBoxInputContainer}>
          {user ?
            <MessageBox
              orbis={orbis}
              user={user}
              context={context}
              messages={messages}
              setMessages={setMessages}
              reply={reply}
              replyTo={replyTo}
              replyToText={replyToText} />
          :
            <p style={{width: "100%", textAlign: "center", margin: 0}}>
              <ConnectButton orbis={orbis} user={user} setUser={setUser} />
            </p>
          }
          </div>
        </div>
      }
    </div>
  );
}

/** List messages sent in the support channel */
function Messages({user, messages, reply, replyTo}) {
  /** Loop through all messages sent in this channel */
  return messages.map((message, key) => {
    return(
      <Message user={user} message={message} key={key} reply={reply} replyTo={replyTo} />
    )
  });
}

/** Display one message */
function Message({user, message, reply, replyTo}) {
  const [hoverRef, isHovered] = useHover();

  return(
    <div ref={hoverRef} className={user && message.creator == user.did ? styles.chatBoxOneMessageContainerSender : styles.chatBoxOneMessageContainer}>
      {/** Left side PfP */}
      {(!user || user == null || (user && message.creator != user.did)) &&
        <div style={{marginRight: 3}}>
          <PfP did={message.creator} details={message.creator_details} displayBadge={false} />
        </div>
      }

      {/** Message content */}
      <div className={styles.flexColumn}>
        {message.reply_to &&
          <div className={styles.flexRow}>
            <div className={styles.chatBoxOneMessageReplyLine}></div>
            <div className={styles.chatBoxOneMessageReply}>{message.reply_to_details && message.reply_to_details.body && message.reply_to_details.body.length > 40 ? shortMessage(message.reply_to_details.body, 40) : message.reply_to_details.body }</div>
          </div>
        }
        <div className={styles.chatBoxOneSupportMessage}><p>{message.content.body}</p></div>
      </div>

      {/** Right-side PfP */}
      {user && message.creator == user.did &&
        <div style={{marginLeft: 3}}>
          <PfP did={message.creator} details={message.creator_details} displayBadge={false} />
        </div>
      }

      {/** Display only if user is hovering the message */}
      {isHovered &&
        <div className={styles.hoveredActions}>
          <div className={styles.hoveredAction} onClick={() => reply(message)}>
            <img src="/img/icons/question-replyto.png" height="15" />
          </div>
        </div>
      }

      {/** Show if the message is being replied to */}
      {replyTo && replyTo == message.stream_id &&
        <div className={styles.hoveredActions}>
          <div className={styles.hoveredAction} onClick={() => reply(null)}>
            <img src="/img/icons/question-replyto-active.png" height="15" />
          </div>
        </div>
      }
    </div>
  )
}

/** Show message box */
function MessageBox({user, orbis, context, messages, setMessages, replyTo, replyToText, reply}) {
  const [message, setMessage] = useState();
  const [sending, setSending] = useState(false);
  const contactInput = useRef(null);

  /** Automatically focus on input when a post is being replied to */
  useEffect(() => {
    if(replyTo) {
      if(contactInput.current) {
        contactInput.current.focus();
      }
    }
  }, [replyTo])

  /** Send message to Cerscan support channel */
  async function sendMessage() {
    /** Make sure message isn't empty. */
    if(!message || message == "") {
      alert("You can't share an empty message.");
      return;
    };
    
    setSending(true);
    let res = await orbis.createPost({
      body: message,
      context: context,
      reply_to: replyTo,
      master: replyTo
    });
    setSending(false);

    /** Reset text box */
    setMessage("");
    if(contactInput.current) {
      contactInput.current.textContent = "";
      contactInput.current.focus();
    }

    /** Generate callback to insert in messages array */
    let nMessage = {
      creator: user.did,
      creator_details: {
        did: user.did,
        profile: user.profile
      },
      stream_id: res.doc,
      content: {
        body: message,
        context: context
      },
      master: replyTo,
      reply_to: replyTo,
      reply_to_details: replyTo ? { body: replyToText } : null,
      reply_to_creator_details: null
    }

    let _messages = [...messages];

    /** Added the created post to the messages array */
    setMessages([nMessage, ..._messages]);
    reply(null);
  }

  return(
    <div className={styles.chatBoxMessageBoxContainer}>
      {/** Show reply to info if message is replying to someone */}
      {replyTo &&
        <div className={styles.chatBoxContactReplyToInfo}>
          <p><span className={styles.chatBoxContactReplyToInfoLabel}>Replying to:</span> {replyToText && replyToText.length > 30 ? shortMessage(replyToText, 30) : replyToText}</p>
        </div>
      }
      <div className={styles.flexRow} style={{width: "100%"}}>
        <div style={{marginRight: 5, display: "flex"}}>
          <PfP did={user.did} details={user} />
        </div>
        <input
          ref={contactInput}
          className={styles.chatBoxInput}
          placeholder="Type your message"
          disabled={sending}
          value={message}
          onChange={(e) => setMessage(e.target.value)} />
        <div className={styles.chatBoxSubmitContainer}>
          {sending ?
            <button className={styles.chatBoxSubmit}>
              <img src="/img/icons/question-spinner.png" className={styles.loadingSpinner} />
            </button>
          :
            <button className={styles.chatBoxSubmit} onClick={() => sendMessage()}>
              <img src="/img/icons/question-send.png" />
            </button>
          }
        </div>
      </div>
    </div>
  )
}

/** Connect button */
export function ConnectButton({orbis, user, setUser}) {
  const [loading, setLoading] = useState(false);

  /** Connect to Ceramic using the Orbis SDK */
  async function connect() {
    setLoading(true);
    let res = await orbis.connect(null, false);

    /** Parse result and update status */
    switch (res.status) {
      case 200:
        /** Save user details returned by the connect function in state */
        setUser(res.details);
        setLoading(false);
        break;
      default:
        console.log("Couldn't connect to Ceramic: ", res.error);
    }
  }

  if(loading) {
    return(
      <div className={styles.btnBlack}>
        <img src="/img/icons/question-spinner.png" height="18" className={styles.loadingSpinner} />
      </div>
    )
  }

  return(
    <>
      {user ?
        <div className={styles.btnBlack}>Connected</div>
      :
        <div className={styles.btnBlack} onClick={() => connect()}>Connect</div>
      }
    </>
  )
}

/** Display profile picture of a user */
export function PfP({did, details}) {
  const { address } = useDidToAddress(did);

  const PfpImg = () => {
    if(details && details.profile && details.profile.pfp) {
      return <img src={details.profile?.pfp} className={styles.pfp} />
    } else if(address) {
      return <img src={makeBlockie(address)} className={styles.pfp} />
    } else {
      return <img src="https://arweave.net/zNxzwq2U7nNZnEosK49drVmOom4nFv89nOlSlbsnczg" className={styles.pfp} />;
    }
  }

  return(
    <div className={styles.pfpContainer}>
      <PfpImg />
    </div>
  )
}

function shortMessage(text, length) {
  if(!text) {
    return "-";
  }

  /** Retrieve first and last characters of a stream to display a shortened version of it */
  const _firstChars = text.substring(0, length);
  return _firstChars + "...";
}

/** Turns a did:pkh into a clean address and chain object */
export default function useDidToAddress(did) {
  let res = getAddressFromDid(did);
  return res;
}


/** Hooks to check if a component is being hovered or not */
export function useHover() {
  const [value, setValue] = useState(false);
  const ref = useRef(null);
  const handleMouseOver = () => setValue(true);
  const handleMouseOut = () => setValue(false);

  useEffect(
    () => {
      const node = ref.current;
      if (node) {
        node.addEventListener("mouseover", handleMouseOver);
        node.addEventListener("mouseout", handleMouseOut);
        return () => {
          node.removeEventListener("mouseover", handleMouseOver);
          node.removeEventListener("mouseout", handleMouseOut);
        };
      }
    },
    [ref.current] // Recall only if ref changes
  );

  return [ref, value];
}
