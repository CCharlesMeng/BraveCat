<script lang="ts">
  import type { PostcardComposition } from './index'

  let {
    composition,
    destinationName,
    renderScene,
  }: {
    composition: PostcardComposition
    destinationName: string
    renderScene: boolean
  } = $props()

  const portraitStyle = $derived([
    `left: ${composition.portrait.anchorX * 100}%`,
    `top: ${composition.portrait.anchorY * 100}%`,
    `height: ${composition.portrait.heightScale * 100}%`,
    `transform: translate(-50%, -100%) scaleX(${composition.portrait.flip ? -1 : 1})`,
  ].join('; '))
</script>

<article class="postcard">
  <div class="picture">
    {#if renderScene}
      <img
        class="scene"
        src={composition.scene.src}
        alt={`${destinationName}的旅行风景`}
      />
      <img
        class="portrait"
        src={composition.portrait.src}
        alt=""
        style={portraitStyle}
      />
    {:else}
      <div class="non-shipping-preview" aria-label="场景仍在发布审核中">
        <img
          src="/assets/postcards/scene-unavailable.png"
          alt="场景仍在发布审核中"
        />
      </div>
    {/if}
  </div>

  <div class="message">
    <div>
      <p>{composition.note}</p>
      <small>{destinationName}</small>
    </div>
    <span class="postmark" aria-label={`邮戳日期 ${composition.postmarkDate}`}>
      <img src="/assets/postcards/postmark.png" alt="" aria-hidden="true" />
      <span>{composition.postmarkDate.slice(5).replace('-', '.')}</span>
    </span>
  </div>
</article>

<style>
  .postcard {
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(91, 83, 64, 0.3);
    border-radius: 8px;
    background:
      url("/assets/postcards/blank-back-378.png") center / cover,
      radial-gradient(rgba(97, 89, 69, 0.045) 0.7px, transparent 0.8px) 0 0 / 6px 6px,
      #f8efd8;
    box-shadow: 0 8px 18px rgba(72, 65, 47, 0.09);
  }

  .picture {
    position: relative;
    aspect-ratio: 4 / 3;
    overflow: hidden;
    background: #e8e3d4;
  }

  .scene {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .portrait {
    position: absolute;
    width: auto;
    object-fit: contain;
    transform-origin: center;
    filter: drop-shadow(0 5px 4px rgba(69, 65, 49, 0.14));
  }

  .non-shipping-preview {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: #eee5d1;
  }

  .non-shipping-preview img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .message {
    display: grid;
    min-height: 82px;
    align-items: center;
    grid-template-columns: minmax(0, 1fr) 54px;
    gap: 12px;
    padding: 14px 16px;
  }

  .message p,
  .message small {
    margin: 0;
  }

  .message p {
    font-size: 0.82rem;
    line-height: 1.75;
    letter-spacing: 0.05em;
  }

  .message small {
    display: block;
    margin-top: 6px;
    color: #838273;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 0.61rem;
  }

  .postmark {
    position: relative;
    display: grid;
    width: 51px;
    height: 51px;
    place-items: center;
    transform: rotate(-8deg);
    color: #8e5445;
    font-family: ui-sans-serif, system-ui, sans-serif;
    font-size: 0.56rem;
  }

  .postmark img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .postmark span {
    position: relative;
  }
</style>
