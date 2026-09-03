import { Router } from 'express';
import settingsRouter from './settings.js';
import authRouter from './auth.js';
import postsRouter from './posts.js';
import projectsRouter from './projects.js';
import photosRouter from './photos.js';
import commentsRouter from './comments.js';
import messagesRouter from './messages.js';
import linksRouter from './links.js';
import musicRouter from './music.js';
import searchRouter from './search.js';
import collectionsRouter from './collections.js';
import essaysRouter from './essays.js';

const router = Router();
router.use(settingsRouter);
router.use(authRouter);
router.use(postsRouter);
router.use(projectsRouter);
router.use(photosRouter);
router.use(commentsRouter);
router.use(messagesRouter);
router.use(linksRouter);
router.use(musicRouter);
router.use(searchRouter);
router.use(collectionsRouter);
router.use(essaysRouter);

export default router;
